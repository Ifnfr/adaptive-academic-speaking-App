import type { LevelUpCheckResult } from "../lib/level-up";
import type { SpeakerLevelProgress, XpProfile } from "../lib/gamification";
import { GamificationPanel } from "./GamificationPanel";
import { LevelUpCheckPanel } from "./LevelUpCheckPanel";

type SessionForProgress = {
  date: string;
  level: string;
  mode: string;
};

type ProgressViewProps = {
  sessions: SessionForProgress[];
  dayStreak: number;
  levelUpCheck: LevelUpCheckResult;
  xpProfile: XpProfile;
  speakerProgress: SpeakerLevelProgress;
  claimableXp: number;
  alreadyClaimedToday: boolean;
  xpEventsCount: number;
  badgesCount: number;
  earnedBadgeLabels: string[];
  onApplyNextLevel: () => void;
  onClaimXp: () => void;
};

export function ProgressView({
  sessions,
  dayStreak,
  levelUpCheck,
  xpProfile,
  speakerProgress,
  claimableXp,
  alreadyClaimedToday,
  xpEventsCount,
  badgesCount,
  earnedBadgeLabels,
  onApplyNextLevel,
  onClaimXp,
}: ProgressViewProps) {
  const total = sessions.length;
  const modeCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.mode] = (acc[s.mode] ?? 0) + 1;
    return acc;
  }, {});
  const levelCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.level] = (acc[s.level] ?? 0) + 1;
    return acc;
  }, {});
  const maxModeCount = Math.max(1, ...Object.values(modeCounts));
  const maxLevelCount = Math.max(1, ...Object.values(levelCounts));

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <div className="sm:col-span-3">
        <GamificationPanel
          profile={xpProfile}
          progress={speakerProgress}
          claimableXp={claimableXp}
          alreadyClaimedToday={alreadyClaimedToday}
          xpEventsCount={xpEventsCount}
          badgesCount={badgesCount}
          earnedBadgeLabels={earnedBadgeLabels}
          onClaimXp={onClaimXp}
        />
      </div>

      <div className="sm:col-span-3">
        <LevelUpCheckPanel
          result={levelUpCheck}
          onApplyNextLevel={onApplyNextLevel}
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Sessions completed
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
          {total}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          Stored locally · max 20
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
          Day Streak
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
          {dayStreak}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          {dayStreak === 0
            ? "Practice today to start"
            : "Consecutive practice days"}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Latest session
        </p>
        <p className="text-sm text-[var(--brand-ink)]">
          {sessions[0]
            ? `${sessions[0].date} · ${sessions[0].mode}`
            : "No data"}
        </p>
      </div>

      <div className="sm:col-span-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Sessions by mode
        </p>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-sm text-[var(--brand-ink-soft)]">
            Complete at least one session to see progress.
          </p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(modeCounts).map(([mode, count]) => (
              <li key={mode} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-[var(--brand-ink)]">
                  {mode}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 rounded-full bg-[var(--brand-teal)]/70"
                  style={{ width: `${(count / maxModeCount) * 60}%` }}
                />
                <span className="ml-auto font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sm:col-span-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Sessions by level
        </p>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-sm text-[var(--brand-ink-soft)]">
            Level counts will appear after your first completed session.
          </p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(levelCounts).map(([level, count]) => (
              <li key={level} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-[var(--brand-ink)]">
                  {level}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 rounded-full bg-[var(--brand-gold)]/70"
                  style={{ width: `${(count / maxLevelCount) * 60}%` }}
                />
                <span className="ml-auto font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
