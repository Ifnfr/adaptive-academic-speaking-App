"use client";

import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import type { UserProfile } from "../lib/storage/supabase-profile-adapter";
import {
  computeSpeakerLevel,
  getSpeakerLevelProgress,
} from "../lib/gamification";

export type ProfileViewProps = {
  isSignedIn: boolean;
  appLanguage?: AppLanguage | null;
  profile: UserProfile | null;
  totalXp: number;
  dayStreak: number;
  totalSessions: number;
  vocabularyCount: number;
  earnedBadgeCount: number;
  earnedBadgeLabels?: string[];
  sessions?: { date: string; mode: string }[];
};

// UI card design patterns matching fonetik's style
const card =
  "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid overflow-hidden";
const cardHeader =
  "border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
const cardBody = "p-6";

export function ProfileView({
  isSignedIn,
  appLanguage,
  profile,
  totalXp,
  dayStreak,
  totalSessions,
  vocabularyCount,
  earnedBadgeCount,
  earnedBadgeLabels = [],
  sessions = [],
}: ProfileViewProps) {
  const { t } = useI18n(appLanguage);

  // Safe display name fallback - MUST NOT fall back to email
  const defaultName = isSignedIn ? "Signed-in learner" : "Local learner";
  const displayName = profile?.displayName?.trim() || defaultName;

  // Initials for avatar fallback
  const initial = displayName.charAt(0).toUpperCase() || "L";

  // Bio fallback
  const bio = profile?.bio?.trim() || "No bio added yet.";

  // Gamification & progress calculations
  const speakerLevelDef = computeSpeakerLevel(totalXp);
  const levelProgress = getSpeakerLevelProgress(totalXp);

  // Leaderboard opt-in status
  const isLeaderboardOptedIn = profile?.leaderboardOptIn ?? false;
  const visibilityStatus = isSignedIn
    ? isLeaderboardOptedIn
      ? "Public Visibility (Opted In)"
      : "Private Visibility (Opted Out)"
    : "Local Visibility Only (Offline)";

  // 7-day activity helper
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return {
      dateString: `${year}-${month}-${day}`,
      dayLabel: d.toLocaleDateString(appLanguage === "id" ? "id-ID" : "en-US", {
        weekday: "short",
      }),
    };
  }).reverse();

  const activityMap = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] ?? 0) + 1;
    return acc;
  }, {});

  // Practice mode breakdown calculations
  const modeCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.mode] = (acc[s.mode] ?? 0) + 1;
    return acc;
  }, {});
  const maxModeCount = Math.max(1, ...Object.values(modeCounts));

  return (
    <div className="flex flex-col gap-6" data-testid="profile-view-container">
      {/* Identity Summary Header Card */}
      <div className={card}>
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
          {/* Avatar Area */}
          <div className="flex justify-center md:justify-start">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt="Learner avatar"
                className="h-20 w-20 rounded-full border border-[var(--brand-border)] object-cover shadow-sm"
                data-testid="profile-avatar-image"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand-teal-ink)] text-2xl font-bold text-white shadow-sm"
                aria-label="Avatar initials"
                data-testid="profile-avatar-fallback"
              >
                {initial}
              </div>
            )}
          </div>

          {/* Details Area */}
          <div className="flex-1 text-center min-w-0 md:text-left">
            <h2
              className="text-xl font-bold text-[var(--brand-ink)] truncate"
              data-testid="profile-display-name"
            >
              {displayName}
            </h2>
            <p
              className="mt-1 text-sm text-[var(--brand-ink-soft)] leading-relaxed italic"
              data-testid="profile-bio"
            >
              {bio}
            </p>
            {profile?.createdAt && (
              <p className="mt-2 text-xs text-[var(--brand-muted)]">
                Joined{" "}
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Grid for Achievements and Gamification Info */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Speaker Level Card */}
        <div className={card}>
          <div className={cardHeader}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
              {t("sidebar.speakerLevel")}
            </p>
            <h3 className="mt-1 text-lg font-bold text-[var(--brand-ink)]">
              Level {speakerLevelDef.level} · {speakerLevelDef.name}
            </h3>
          </div>
          <div className={cardBody}>
            <div className="flex flex-col gap-4">
              {/* Progress bar */}
              {levelProgress.nextLevel ? (
                <div>
                  <div className="flex items-center justify-between text-xs text-[var(--brand-ink-soft)] mb-2 font-mono">
                    <span>{levelProgress.xpIntoLevel} XP</span>
                    <span>
                      {levelProgress.xpIntoLevel + levelProgress.xpNeededForNext} XP
                    </span>
                  </div>
                  <div
                    className="h-3 w-full rounded-full bg-[var(--brand-border)] overflow-hidden"
                    title={`${(levelProgress.progressRatio * 100).toFixed(0)}% complete`}
                  >
                    <div
                      className="h-full rounded-full bg-[var(--brand-teal)] transition-all duration-500 ease-out"
                      style={{ width: `${levelProgress.progressRatio * 100}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-xs text-[var(--brand-ink-soft)] leading-normal">
                    Earn <span className="font-semibold font-mono text-[var(--brand-teal-ink)]">{levelProgress.xpNeededForNext} XP</span> more to reach Level {levelProgress.nextLevel.level} ({levelProgress.nextLevel.name}).
                  </p>
                </div>
              ) : (
                <p className="text-sm font-medium text-green-600 font-mono">
                  {t("game.maxReached")} 🎉
                </p>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-[var(--brand-border)] font-mono text-sm text-[var(--brand-ink)]">
                <span>Total XP:</span>
                <span className="font-semibold text-lg" data-testid="profile-total-xp">
                  {totalXp} XP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Local Achievement Counts Card */}
        <div className={card}>
          <div className={cardHeader}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
              {t("profile.yourProgress")}
            </p>
            <h3 className="mt-1 text-lg font-bold text-[var(--brand-ink)]">
              {t("profile.localStats")}
            </h3>
          </div>
          <div className={cardBody}>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-[var(--brand-surface-2)] p-4 text-center border border-[var(--brand-border)]">
                <span className="block text-2xl font-bold font-mono text-[var(--brand-ink)]">
                  {totalSessions}
                </span>
                <span className="text-xs text-[var(--brand-ink-soft)]">
                  Sessions
                </span>
              </div>
              <div className="rounded-xl bg-[var(--brand-surface-2)] p-4 text-center border border-[var(--brand-border)]">
                <span className="block text-2xl font-bold font-mono text-[var(--brand-ink)]">
                  {dayStreak}
                </span>
                <span className="text-xs text-[var(--brand-ink-soft)]">
                  Day Streak
                </span>
              </div>
              <div className="rounded-xl bg-[var(--brand-surface-2)] p-4 text-center border border-[var(--brand-border)]">
                <span className="block text-2xl font-bold font-mono text-[var(--brand-ink)]">
                  {vocabularyCount}
                </span>
                <span className="text-xs text-[var(--brand-ink-soft)]">
                  Vocab Words
                </span>
              </div>
              <div className="rounded-xl bg-[var(--brand-surface-2)] p-4 text-center border border-[var(--brand-border)]">
                <span className="block text-2xl font-bold font-mono text-[var(--brand-ink)]">
                  {earnedBadgeCount}
                </span>
                <span className="text-xs text-[var(--brand-ink-soft)]">
                  Badges
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Activity & Practice Modes */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 7-Day Activity Card */}
        <div className={card}>
          <div className={cardHeader}>
            <h3 className="text-base font-bold text-[var(--brand-ink)]">
              7-Day Activity Summary
            </h3>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              Your practice sessions completed over the last week.
            </p>
          </div>
          <div className={cardBody}>
            <div className="flex justify-between items-end gap-1 px-2 pt-4">
              {last7Days.map((day) => {
                const count = activityMap[day.dateString] ?? 0;
                const hasActivity = count > 0;
                return (
                  <div key={day.dateString} className="flex flex-col items-center flex-1 gap-2">
                    <div className="text-[10px] text-[var(--brand-muted)] font-mono">
                      {count > 0 ? `${count}x` : ""}
                    </div>
                    <div
                      className={[
                        "w-full max-w-[28px] rounded-t-md transition-all duration-300",
                        hasActivity
                          ? "bg-[var(--brand-teal)] min-h-[16px]"
                          : "bg-[var(--brand-border)] h-2",
                      ].join(" ")}
                      style={{
                        height: hasActivity
                          ? `${Math.min(60, 16 + count * 12)}px`
                          : undefined,
                      }}
                      title={`${day.dateString}: ${count} session(s)`}
                    />
                    <span className="text-xs font-medium text-[var(--brand-ink-soft)]">
                      {day.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Practice Mode Breakdown Card */}
        <div className={card}>
          <div className={cardHeader}>
            <h3 className="text-base font-bold text-[var(--brand-ink)]">
              Practice Mode Breakdown
            </h3>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              Distribution of sessions by practice type.
            </p>
          </div>
          <div className={cardBody}>
            {sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-sm text-[var(--brand-ink-soft)] text-center">
                Complete at least one practice session to view stats.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {Object.entries(modeCounts).map(([mode, count]) => (
                  <div key={mode} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-xs text-[var(--brand-ink)] font-medium truncate">
                      {mode}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--brand-border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--brand-teal)]/70 rounded-full"
                        style={{ width: `${(count / maxModeCount) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-[var(--brand-ink-soft)] shrink-0 w-6 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Earned Badges Preview Card */}
      {earnedBadgeCount > 0 && earnedBadgeLabels.length > 0 && (
        <div className={card}>
          <div className={cardHeader}>
            <h3 className="text-base font-bold text-[var(--brand-ink)]">
              Earned Badges
            </h3>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              Showcasing your latest achievements.
            </p>
          </div>
          <div className={cardBody}>
            <div className="flex flex-wrap gap-2">
              {earnedBadgeLabels.slice(0, 5).map((label, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-gold)]/10 border border-[var(--brand-gold)]/30 px-3 py-1 text-xs font-semibold text-[var(--brand-gold)] font-mono"
                  data-testid={`earned-badge-tag-${idx}`}
                >
                  🏆 {label}
                </span>
              ))}
              {earnedBadgeLabels.length > 5 && (
                <span className="inline-flex items-center rounded-full bg-[var(--brand-border)] px-3 py-1 text-xs font-medium text-[var(--brand-ink-soft)] font-mono">
                  +{earnedBadgeLabels.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Privacy and Leaderboard Status Info */}
      <div className={card}>
        <div className={cardHeader}>
          <h3 className="text-base font-bold text-[var(--brand-ink)]">
            Privacy & Visibility
          </h3>
        </div>
        <div className={cardBody}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)]">
              <span className="text-sm text-[var(--brand-ink-soft)]">Leaderboard Status:</span>
              <span
                className={[
                  "text-xs font-bold px-2.5 py-1 rounded-full font-mono border",
                  isLeaderboardOptedIn
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-700",
                ].join(" ")}
                data-testid="leaderboard-visibility-status"
              >
                {visibilityStatus}
              </span>
            </div>

            <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
              <p className="text-xs text-[var(--brand-ink-soft)] leading-relaxed">
                <span className="font-semibold text-[var(--brand-teal-ink)]">Privacy Reassurance:</span> We strictly safeguard your learning data. Under no circumstances will the system publish, share, or render transcripts, retry transcripts, vocabulary sentence histories, AI corrections, article URLs, weaknesses, retry tasks, CSV summaries, or private learning notes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
