import { XP_RULES, computeSpeakerLevel } from "../gamification";

// ---------- Types ----------

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";

export interface LeaderboardProfileInput {
  ownerId: string;
  id: string; // Safe UUID
  displayName?: string | null;
  avatarUrl?: string | null;
  leaderboardOptIn: boolean;
  learnerLevel?: string | null;
  totalXp?: number; // Claimed total XP
}

export interface LeaderboardEventInput {
  ownerId?: string | null;
  owner_id?: string | null;
  type?: string | null;
  xp?: number | null;
  localDate?: string | null;
  local_date?: string | null;
  sourceId?: string | null;
  source_id?: string | null;
}

export interface LeaderboardBadgeInput {
  ownerId: string;
  owner_id?: string | null;
  status: "locked" | "earned";
}

export interface LeaderboardPublicEntry {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  level: {
    number: number;
    name: string;
  };
  periodXp: number;
  badgeCount: number;
}

export interface LeaderboardCurrentUser {
  isSignedIn: boolean;
  optedIn: boolean;
  visibility: "signed-out" | "public" | "private";
  rank: number | null; // null if not opted in or signed out
  previewRank: number; // calculated rank even if opted out
  periodXp: number;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  level: {
    number: number;
    name: string;
  };
}

export interface LeaderboardSnapshot {
  period: LeaderboardPeriod;
  leaderboard: LeaderboardPublicEntry[];
  currentUser: LeaderboardCurrentUser;
}

// ---------- Period Helpers ----------

export function normalizeLeaderboardPeriod(period: string | null | undefined): LeaderboardPeriod {
  if (!period) return "weekly";
  const lower = period.trim().toLowerCase();
  if (lower === "daily" || lower === "weekly" || lower === "monthly" || lower === "all-time") {
    return lower as LeaderboardPeriod;
  }
  return "weekly";
}

export function getLeaderboardPeriodBounds(
  period: string | null | undefined,
  currentDateStr: string
): { startDate: string | null; endDate: string | null } {
  const normalized = normalizeLeaderboardPeriod(period);
  if (normalized === "all-time") {
    return { startDate: null, endDate: null };
  }

  const match = currentDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date format: ${currentDateStr}. Expected YYYY-MM-DD.`);
  }

  const [, yStr, mStr, dStr] = match;
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1; // 0-indexed
  const day = parseInt(dStr, 10);

  const currentDate = new Date(Date.UTC(year, month, day));

  const getLocalDateString = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const date = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${date}`;
  };

  if (normalized === "daily") {
    return { startDate: currentDateStr, endDate: currentDateStr };
  }

  if (normalized === "weekly") {
    const utcDay = currentDate.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;

    const monday = new Date(currentDate);
    monday.setUTCDate(currentDate.getUTCDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return {
      startDate: getLocalDateString(monday),
      endDate: getLocalDateString(sunday),
    };
  }

  if (normalized === "monthly") {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    return {
      startDate: getLocalDateString(firstDay),
      endDate: getLocalDateString(lastDay),
    };
  }

  return { startDate: null, endDate: null };
}

// ---------- Formatting Fallbacks ----------

function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return "S";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getSafeDisplayName(name: string | null | undefined, id: string): string {
  if (!name || !name.trim()) {
    const suffix = id ? id.slice(-4).toUpperCase() : "XXXX";
    return `Speaker #${suffix}`;
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// ---------- Core Aggregator ----------

export function buildLeaderboardSnapshot(params: {
  period: string | null | undefined;
  currentDateStr: string;
  profiles: LeaderboardProfileInput[];
  events: LeaderboardEventInput[];
  badges?: LeaderboardBadgeInput[];
  currentUserId?: string | null;
}): LeaderboardSnapshot {
  const normalizedPeriod = normalizeLeaderboardPeriod(params.period);
  const { startDate, endDate } = getLeaderboardPeriodBounds(normalizedPeriod, params.currentDateStr);
  const currentUserId = params.currentUserId || null;

  const validEventTypes = new Set(Object.keys(XP_RULES));

  // 1. Filter, Validate, and Deduplicate Events
  const deduplicatedEvents: LeaderboardEventInput[] = [];
  const seenKeys = new Set<string>();

  for (const event of params.events) {
    const ownerId = event.ownerId || event.owner_id;
    const type = event.type;
    const xp = event.xp;
    const localDate = event.localDate || event.local_date;
    const sourceId = event.sourceId || event.source_id;

    // Validation checks
    if (!ownerId || !type || !sourceId || xp === undefined || xp === null || xp <= 0) {
      continue;
    }
    if (!validEventTypes.has(type)) {
      continue;
    }
    if (normalizedPeriod !== "all-time" && !localDate) {
      continue;
    }

    // Date range checks
    if (startDate && localDate && localDate < startDate) continue;
    if (endDate && localDate && localDate > endDate) continue;

    // Deduplication check
    const dedupKey = `${ownerId}:${type}:${sourceId}`;
    if (seenKeys.has(dedupKey)) {
      continue;
    }
    seenKeys.add(dedupKey);
    deduplicatedEvents.push(event);
  }

  // 2. Sum valid period XP per owner
  const xpMap = new Map<string, number>();
  for (const event of deduplicatedEvents) {
    const ownerId = (event.ownerId || event.owner_id)!;
    xpMap.set(ownerId, (xpMap.get(ownerId) || 0) + event.xp!);
  }

  // 3. Count earned badges per owner
  const badgeMap = new Map<string, number>();
  for (const badge of params.badges || []) {
    const ownerId = badge.ownerId || badge.owner_id;
    if (ownerId && badge.status === "earned") {
      badgeMap.set(ownerId, (badgeMap.get(ownerId) || 0) + 1);
    }
  }

  // Helper to map profiles
  const getProfileData = (p: LeaderboardProfileInput, ownerId: string) => {
    const totalXp = p.totalXp || 0;
    const speakerLevel = computeSpeakerLevel(totalXp);
    return {
      displayName: getSafeDisplayName(p.displayName, p.id),
      avatarUrl: p.avatarUrl || null,
      initials: getInitials(p.displayName),
      level: {
        number: speakerLevel.level,
        name: speakerLevel.name,
      },
      periodXp: normalizedPeriod === "all-time" ? totalXp : (xpMap.get(ownerId) || 0),
      badgeCount: badgeMap.get(ownerId) || 0,
    };
  };

  // 4. Build public leaderboard entries (only opted-in users with periodXp > 0)
  const publicProfiles = params.profiles.filter(
    (p) =>
      p.leaderboardOptIn === true &&
      (normalizedPeriod === "all-time"
        ? (p.totalXp || 0) > 0
        : (xpMap.get(p.ownerId) || 0) > 0),
  );

  const rawEntries = publicProfiles.map((p) => {
    const mapped = getProfileData(p, p.ownerId);
    return {
      id: p.id,
      ownerId: p.ownerId,
      ...mapped,
    };
  });

  // Sort by periodXp descending
  rawEntries.sort((a, b) => b.periodXp - a.periodXp);

  // Assign standard competition ranks (1, 2, 2, 4...)
  let currentRank = 1;
  let prevXp = -1;
  const publicLeaderboard: LeaderboardPublicEntry[] = rawEntries.map((entry, idx) => {
    if (entry.periodXp !== prevXp) {
      currentRank = idx + 1;
      prevXp = entry.periodXp;
    }
    return {
      rank: currentRank,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      initials: entry.initials,
      level: entry.level,
      periodXp: entry.periodXp,
      badgeCount: entry.badgeCount,
    };
  });

  // 5. Build current user rank and preview rank
  let currentUserResponse: LeaderboardCurrentUser;
  const profile = currentUserId ? params.profiles.find((p) => p.ownerId === currentUserId) : null;

  if (profile) {
    const userXp = normalizedPeriod === "all-time" ? (profile.totalXp || 0) : (xpMap.get(currentUserId!) || 0);
    const mappedUser = getProfileData(profile, currentUserId!);

    // Calculate public rank if opted-in and has XP
    let publicRank = -1;
    if (profile.leaderboardOptIn && userXp > 0) {
      const match = rawEntries.findIndex((e) => e.ownerId === currentUserId);
      if (match !== -1) {
        publicRank = publicLeaderboard[match].rank;
      }
    }

    // Calculate preview rank (where they would rank if they opted in)
    // Create a virtual public list including the user
    const previewList = [...rawEntries];
    if (!profile.leaderboardOptIn || userXp === 0) {
      // Find and remove if already exists, then insert
      const idx = previewList.findIndex((e) => e.ownerId === currentUserId);
      if (idx !== -1) {
        previewList.splice(idx, 1);
      }
      previewList.push({
        id: profile.id,
        ownerId: profile.ownerId,
        ...mappedUser,
      });
    }

    previewList.sort((a, b) => b.periodXp - a.periodXp);

    let virtualRank = 1;
    let vPrevXp = -1;
    let previewRank = -1;

    for (let i = 0; i < previewList.length; i++) {
      const item = previewList[i];
      if (item.periodXp !== vPrevXp) {
        virtualRank = i + 1;
        vPrevXp = item.periodXp;
      }
      if (item.ownerId === currentUserId) {
        previewRank = virtualRank;
        break;
      }
    }

    currentUserResponse = {
      isSignedIn: true,
      optedIn: profile.leaderboardOptIn,
      visibility: profile.leaderboardOptIn ? "public" : "private",
      rank: profile.leaderboardOptIn && userXp > 0 ? publicRank : null,
      previewRank: previewRank,
      periodXp: userXp,
      displayName: profile.displayName || "You",
      avatarUrl: profile.avatarUrl || null,
      initials: mappedUser.initials,
      level: mappedUser.level,
    };
  } else {
    currentUserResponse = {
      isSignedIn: false,
      optedIn: false,
      visibility: "signed-out",
      rank: -1,
      previewRank: -1,
      periodXp: 0,
      displayName: "",
      avatarUrl: null,
      initials: "S",
      level: {
        number: 1,
        name: "New Speaker",
      },
    };
  }

  return {
    period: normalizedPeriod,
    leaderboard: publicLeaderboard.slice(0, 50),
    currentUser: currentUserResponse,
  };
}
