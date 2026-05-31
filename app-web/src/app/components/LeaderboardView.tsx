import { useEffect, useState } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import type { LeaderboardSnapshot, LeaderboardPeriod } from "../lib/leaderboard/leaderboard-aggregation";
import type { SpeakerLevelProgress } from "../lib/gamification";

type LeaderboardViewProps = {
  isSignedIn?: boolean;
  getToken?: (() => Promise<string | null>) | null;
  ownerProfile?: { displayName?: string | null } | null;
  speakerProgress?: SpeakerLevelProgress | null;
  appLanguage?: AppLanguage | null;
  onGoToSettings?: () => void;
};

const getInitials = (name?: string | null) => {
  if (!name || !name.trim()) return "S";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export function LeaderboardView({
  isSignedIn: propIsSignedIn,
  getToken,
  ownerProfile,
  speakerProgress,
  appLanguage,
  onGoToSettings,
}: LeaderboardViewProps) {
  const { t } = useI18n(appLanguage);
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeaderboardSnapshot | null>(null);

  const isSignedIn = Boolean(propIsSignedIn || data?.currentUser?.isSignedIn);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const headers: Record<string, string> = {};
        if (propIsSignedIn && getToken) {
          const token = await getToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }
        const res = await fetch(`/api/leaderboard?period=${period}`, { headers });
        if (!res.ok) {
          throw new Error("Failed to fetch leaderboard data.");
        }
        const snapshot = await res.json();
        if (active) {
          setData(snapshot);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          const errMsg = err instanceof Error ? err.message : "Failed to load leaderboard.";
          setError(errMsg);
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [period, propIsSignedIn, getToken]);

  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
  const cardHeader =
    "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";

  const periods: { value: LeaderboardPeriod; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "all-time", label: "All-time" },
  ];

  return (
    <section className={card} id="leaderboard-view">
      {/* Header with Period Tabs */}
      <div className={`${cardHeader} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            Analytics & Progress
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("topbar.titleLeaderboard")}
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            {t("topbar.descLeaderboard")}
          </p>
        </div>

        {/* Period Tabs */}
        <div className="flex rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-1" role="tablist">
          {periods.map((p) => (
            <button
              key={p.value}
              role="tab"
              aria-selected={period === p.value}
              onClick={() => {
                setPeriod(p.value);
                setLoading(true);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
                period === p.value
                  ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] font-semibold"
                  : "text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface-2)] hover:text-[var(--brand-ink)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body States */}
      <div className={cardBody}>
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center" id="leaderboard-loading">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--brand-teal-soft)] border-t-[var(--brand-teal)]"></div>
            <p className="mt-4 text-sm text-[var(--brand-ink-soft)]">Loading leaderboard progress...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-[var(--brand-coral)]/30 bg-[var(--brand-coral-soft)] p-6 text-center" id="leaderboard-error">
            <p className="text-sm font-semibold text-[var(--brand-coral)]">Service Unavailable</p>
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                setPeriod((prev) => prev);
              }}
              className={`${buttonSecondary} mt-4 text-xs`}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="flex flex-col gap-6" id="leaderboard-ready">
            {/* Signed-out Notice */}
            {!isSignedIn && (
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-center" id="leaderboard-signed-out">
                <p className="text-sm text-[var(--brand-ink-soft)]">
                  You are currently signed out. Sign in to track your level, badges, and compete with other learners.
                </p>
              </div>
            )}

            {/* Signed-in Opt-in Required / Private State Notice */}
            {isSignedIn && data.currentUser.visibility === "private" && (
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5" id="leaderboard-private-notice">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                      Your leaderboard visibility is set to Private
                    </h3>
                    <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                      Your username, level, and XP are hidden from the public leaderboard. Turn on &quot;Leaderboard opt-in&quot; in settings to share your achievements with the community.
                    </p>
                  </div>
                  {onGoToSettings && (
                    <button
                      type="button"
                      onClick={onGoToSettings}
                      className={buttonSecondary}
                    >
                      Settings
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Current User Card (only if signed in) */}
            {isSignedIn && (
              <div className="rounded-xl border-l-4 border-l-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4" id="leaderboard-current-user-card">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-teal)]">
                  Your Current Standings
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-xs font-bold text-[var(--brand-teal-ink)]">
                      {data.currentUser.isSignedIn ? data.currentUser.initials : getInitials(ownerProfile?.displayName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--brand-ink)]">
                        {data.currentUser.isSignedIn ? data.currentUser.displayName : (ownerProfile?.displayName || "You")}
                      </p>
                      <p className="text-xs text-[var(--brand-ink-soft)]">
                        {data.currentUser.isSignedIn ? (
                          `Level ${data.currentUser.level.number} · ${data.currentUser.level.name}`
                        ) : (
                          speakerProgress ? `Level ${speakerProgress.currentLevel.level} · ${speakerProgress.currentLevel.name}` : "Level 1"
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--brand-ink)]">
                      {data.currentUser.isSignedIn ? data.currentUser.periodXp : 0} XP
                    </p>
                    <p className="text-xs text-[var(--brand-ink-soft)]">
                      {data.currentUser.isSignedIn ? (
                        data.currentUser.visibility === "private" ? (
                          <span>Simulated Rank #{data.currentUser.previewRank}</span>
                        ) : (
                          <span>Rank #{data.currentUser.rank ?? "—"}</span>
                        )
                      ) : (
                        <span>Rank #—</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Top 3 Podium Cards */}
            {data.leaderboard.length >= 3 && (
              <div className="grid grid-cols-3 items-end gap-3 py-6" id="leaderboard-podium">
                {/* 2nd place */}
                <div className="flex flex-col items-center rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-center">
                  <span className="text-xs font-bold text-[var(--brand-muted)]">2nd</span>
                  <div className="my-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border-strong)] text-xs font-bold">
                    {data.leaderboard[1].initials}
                  </div>
                  <p className="truncate w-full text-xs font-semibold text-[var(--brand-ink)]">
                    {data.leaderboard[1].displayName}
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-[var(--brand-ink-soft)]">
                    {data.leaderboard[1].periodXp} XP
                  </p>
                </div>

                {/* 1st place */}
                <div className="flex flex-col items-center rounded-xl border-2 border-[var(--brand-teal)] bg-[var(--brand-surface-2)] p-5 text-center shadow-md transform -translate-y-2">
                  <span className="text-xs font-bold text-[var(--brand-teal-ink)]">🥇 1st</span>
                  <div className="my-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] border-2 border-[var(--brand-teal)] text-sm font-bold text-[var(--brand-teal-ink)]">
                    {data.leaderboard[0].initials}
                  </div>
                  <p className="truncate w-full text-sm font-semibold text-[var(--brand-ink)]">
                    {data.leaderboard[0].displayName}
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-[var(--brand-teal-ink)]">
                    {data.leaderboard[0].periodXp} XP
                  </p>
                </div>

                {/* 3rd place */}
                <div className="flex flex-col items-center rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-center">
                  <span className="text-xs font-bold text-[var(--brand-muted)]">3rd</span>
                  <div className="my-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border-strong)] text-xs font-bold">
                    {data.leaderboard[2].initials}
                  </div>
                  <p className="truncate w-full text-xs font-semibold text-[var(--brand-ink)]">
                    {data.leaderboard[2].displayName}
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-[var(--brand-ink-soft)]">
                    {data.leaderboard[2].periodXp} XP
                  </p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {data.leaderboard.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center" id="leaderboard-empty">
                <p className="text-sm text-[var(--brand-ink-soft)]">
                  {isSignedIn
                    ? "No leaderboard activity for this period yet. Complete an eligible practice session to appear here."
                    : "No active users on the leaderboard for this period yet. Complete a speaking session to be the first!"}
                </p>
              </div>
            )}

            {/* Ranking List */}
            {data.leaderboard.length > 0 && (
              <div className="mt-2" id="leaderboard-list">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-3">
                  Rankings
                </p>
                <div className="divide-y divide-[var(--brand-border)]">
                  {data.leaderboard.map((user) => (
                    <div key={user.rank + "-" + user.displayName} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-sm font-semibold text-[var(--brand-ink-soft)] text-center">
                          {user.rank}
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-surface-2)] border border-[var(--brand-border)] text-xs font-medium text-[var(--brand-ink)]">
                          {user.initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--brand-ink)]">
                            {user.displayName}
                          </p>
                          <p className="text-[11px] text-[var(--brand-ink-soft)]">
                            Level {user.level.number} · {user.level.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {user.badgeCount > 0 && (
                          <span className="rounded-full bg-[var(--brand-surface-2)] border border-[var(--brand-border)] px-2 py-0.5 text-[10px] text-[var(--brand-ink-soft)]">
                            🏆 {user.badgeCount}
                          </span>
                        )}
                        <span className="font-mono text-sm font-semibold text-[var(--brand-ink)]">
                          {user.periodXp} XP
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
