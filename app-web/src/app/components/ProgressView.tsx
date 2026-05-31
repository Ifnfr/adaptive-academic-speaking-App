import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import type { LevelUpCheckResult } from "../lib/level-up";
import type { SpeakerLevelProgress, XpProfile, XpEvent } from "../lib/gamification";
import type { SidebarView } from "./Sidebar";
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
  appLanguage?: AppLanguage | null;
  onApplyNextLevel: () => void;
  onClaimXp: () => void;
  onSelectView?: (view: SidebarView) => void;
  xpEvents?: XpEvent[];
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
  appLanguage,
  onApplyNextLevel,
  onClaimXp,
  onSelectView,
  xpEvents,
}: ProgressViewProps) {
  const { t } = useI18n(appLanguage);
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
          appLanguage={appLanguage}
          onClaimXp={onClaimXp}
          onSelectView={onSelectView}
          xpEvents={xpEvents}
          sessionsCount={total}
        />
      </div>

      <div className="sm:col-span-3">
        <LevelUpCheckPanel
          result={levelUpCheck}
          onApplyNextLevel={onApplyNextLevel}
          appLanguage={appLanguage}
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          {t("progress.sessionsCompleted")}
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
          {total}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          {t("sidebar.storedLocally")} · {t("sidebar.max20")}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
          {t("sidebar.dayStreak")}
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
          {dayStreak}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          {dayStreak === 0
            ? t("progress.streakTaglineStart")
            : t("progress.streakTaglineConsecutive")}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          {t("progress.latestSession")}
        </p>
        <p className="text-sm text-[var(--brand-ink)]">
          {sessions[0]
            ? `${sessions[0].date} · ${sessions[0].mode}`
            : t("progress.noData")}
        </p>
      </div>

      <div className="sm:col-span-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          {t("progress.sessionsByMode")}
        </p>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-sm text-[var(--brand-ink-soft)]">
            {t("progress.completeToSee")}
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
          {t("progress.sessionsByLevel")}
        </p>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-sm text-[var(--brand-ink-soft)]">
            {t("progress.levelAppear")}
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
