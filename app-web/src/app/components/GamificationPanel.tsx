import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import type { SpeakerLevelProgress, XpProfile } from "../lib/gamification";
import { XpClaimCard } from "./XpClaimCard";

type GamificationPanelProps = {
  profile: XpProfile;
  progress: SpeakerLevelProgress;
  claimableXp: number;
  alreadyClaimedToday: boolean;
  xpEventsCount: number;
  badgesCount: number;
  earnedBadgeLabels: string[];
  appLanguage?: AppLanguage | null;
  onClaimXp: () => void;
};

export function GamificationPanel({
  profile,
  progress,
  claimableXp,
  alreadyClaimedToday,
  xpEventsCount,
  badgesCount,
  earnedBadgeLabels,
  appLanguage,
  onClaimXp,
}: GamificationPanelProps) {
  const { t } = useI18n(appLanguage);
  const percent = Math.round(progress.progressRatio * 100);

  return (
    <div className="rounded-xl border-l-4 border-[var(--brand-gold)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
            {t("sidebar.speakerLevel")}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
            Level {progress.currentLevel.level} · {progress.currentLevel.name}
          </h3>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            {t("game.gamificationSeparate")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            Total XP
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--brand-ink)]">
            {profile.totalXp}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            {t("game.xpProgress")}
          </p>
          <p className="font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
            {progress.nextLevel
              ? `${progress.xpNeededForNext} XP ${t("game.xpNeeded")} ${progress.nextLevel.level}`
              : t("game.maxReached")}
          </p>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--brand-border)]">
          <div
            className="h-full rounded-full bg-[var(--brand-gold)]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
          {percent}% {t("game.percentComplete")}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label={t("game.pendingToday")} value={`${profile.pendingDailyXp} XP`} />
        <StatCard
          label={t("game.prevUnclaimed")}
          value={`${profile.unclaimedPreviousXp} XP`}
        />
        <StatCard label={t("game.rewardEvents")} value={String(xpEventsCount)} />
        <StatCard label={t("game.badges")} value={String(badgesCount)} />
      </div>

      {earnedBadgeLabels.length > 0 && (
        <div className="mt-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            {t("game.earnedBadges")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {earnedBadgeLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--brand-ink)]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <XpClaimCard
          claimableXp={claimableXp}
          alreadyClaimedToday={alreadyClaimedToday}
          onClaimXp={onClaimXp}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--brand-ink)]">
        {value}
      </p>
    </div>
  );
}
