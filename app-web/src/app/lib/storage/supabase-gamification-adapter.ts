/**
 * Supabase gamification adapter persistence helpers.
 *
 * This adapter manages mapping and writing of XP profiles,
 * XP events, and badges to the cloud.
 */

import type { FonetikSupabaseClient } from "../supabase";
import type { XpProfile, XpEvent, Badge, XpEventType, BadgeStatus } from "../gamification";

const XP_PROFILES_TABLE = "xp_profiles";
const XP_EVENTS_TABLE = "xp_events";
const BADGES_TABLE = "badges";

export type SupabaseXpProfileRow = {
  owner_id: string;
  total_xp: number;
  pending_daily_xp: number;
  unclaimed_previous_xp: number;
  active_date: string | null;
  last_claimed_date: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseXpProfileInsert = {
  owner_id: string;
  total_xp: number;
  pending_daily_xp: number;
  unclaimed_previous_xp: number;
  active_date?: string | null;
  last_claimed_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SupabaseXpEventRow = {
  id: string;
  owner_id: string;
  client_id: string | null;
  type: string;
  xp: number;
  local_date: string | null;
  source_id: string;
  source_kind: string | null;
  reason: string | null;
  created_at: string;
};

export type SupabaseXpEventInsert = {
  owner_id: string;
  client_id?: string;
  type: string;
  xp: number;
  local_date?: string;
  source_id: string;
  source_kind?: string;
  reason?: string;
  created_at?: string;
};

export type SupabaseBadgeRow = {
  id: string;
  owner_id: string;
  badge_id: string;
  label: string | null;
  description: string | null;
  status: string | null;
  earned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseBadgeInsert = {
  owner_id: string;
  badge_id: string;
  label?: string;
  description?: string;
  status?: string;
  earned_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export function mapStoredProfileToSupabaseInsert(
  ownerId: string,
  profile: XpProfile,
): SupabaseXpProfileInsert {
  return {
    owner_id: ownerId,
    total_xp: profile.totalXp,
    pending_daily_xp: profile.pendingDailyXp,
    unclaimed_previous_xp: profile.unclaimedPreviousXp,
    active_date: profile.activeDate,
    last_claimed_date: profile.lastClaimedDate,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export function mapStoredEventToSupabaseInsert(
  ownerId: string,
  event: XpEvent,
): SupabaseXpEventInsert {
  return {
    owner_id: ownerId,
    client_id: event.id,
    type: event.type,
    xp: event.xp,
    local_date: event.localDate,
    source_id: event.sourceId,
    source_kind: event.sourceKind,
    reason: event.reason,
    created_at: event.createdAt,
  };
}

export function mapStoredBadgeToSupabaseInsert(
  ownerId: string,
  badge: Badge,
): SupabaseBadgeInsert {
  return {
    owner_id: ownerId,
    badge_id: badge.id,
    label: badge.label,
    description: badge.description,
    status: badge.status,
    earned_at: badge.earnedAt,
  };
}

export function mapSupabaseRowToStoredProfile(
  row: SupabaseXpProfileRow,
): XpProfile {
  return {
    version: 1,
    totalXp: row.total_xp,
    pendingDailyXp: row.pending_daily_xp,
    unclaimedPreviousXp: row.unclaimed_previous_xp,
    activeDate: row.active_date ?? "",
    lastClaimedDate: row.last_claimed_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSupabaseRowToStoredEvent(
  row: SupabaseXpEventRow,
): XpEvent {
  return {
    version: 1,
    id: row.client_id ?? "",
    type: row.type as XpEventType,
    xp: row.xp,
    localDate: row.local_date ?? "",
    createdAt: row.created_at,
    sourceId: row.source_id,
    sourceKind: (row.source_kind as XpEvent["sourceKind"]) ?? "session",
    reason: row.reason ?? "",
  };
}

export function mapSupabaseRowToStoredBadge(
  row: SupabaseBadgeRow,
): Badge {
  return {
    version: 1,
    id: row.badge_id,
    label: row.label ?? "",
    description: row.description ?? "",
    status: (row.status as BadgeStatus) ?? "locked",
    earnedAt: row.earned_at,
  };
}

/**
 * Upserts the XP profile.
 */
export async function upsertXpProfileRow(
  ownerId: string,
  profile: XpProfile,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  const insertData = mapStoredProfileToSupabaseInsert(ownerId, profile);
  const { error } = await supabaseClient
    .from(XP_PROFILES_TABLE)
    .upsert(insertData, { onConflict: "owner_id" });

  if (error) {
    throw error;
  }
}

/**
 * Upserts XP events. On conflict (owner_id, type, source_id) do nothing to avoid duplicate awards.
 */
export async function upsertXpEventRows(
  ownerId: string,
  events: ReadonlyArray<XpEvent>,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  if (events.length === 0) return;

  const insertData = events.map((event) =>
    mapStoredEventToSupabaseInsert(ownerId, event),
  );

  const { error } = await supabaseClient
    .from(XP_EVENTS_TABLE)
    .upsert(insertData, { onConflict: "owner_id,type,source_id" });

  if (error) {
    throw error;
  }
}

/**
 * Upserts Badge configurations.
 */
export async function upsertBadgeRows(
  ownerId: string,
  badges: ReadonlyArray<Badge>,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  if (badges.length === 0) return;

  const insertData = badges.map((badge) =>
    mapStoredBadgeToSupabaseInsert(ownerId, badge),
  );

  const { error } = await supabaseClient
    .from(BADGES_TABLE)
    .upsert(insertData, { onConflict: "owner_id,badge_id" });

  if (error) {
    throw error;
  }
}
