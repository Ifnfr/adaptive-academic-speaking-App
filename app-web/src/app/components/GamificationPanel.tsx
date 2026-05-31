import { useState, useEffect } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import type { SpeakerLevelProgress, XpProfile, XpEvent } from "../lib/gamification";
import { getLocalDateString } from "../lib/gamification";
import { loadProgress } from "../lib/learning-path/progress";
import { XpClaimCard } from "./XpClaimCard";
import type { SidebarView } from "./Sidebar";

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
  onSelectView?: (view: SidebarView) => void;
  xpEvents?: XpEvent[];
  sessionsCount?: number;
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
  onSelectView,
  xpEvents = [],
  sessionsCount = 0,
}: GamificationPanelProps) {
  const { t } = useI18n(appLanguage);
  const percent = Math.round(progress.progressRatio * 100);

  const [lpStatus, setLpStatus] = useState<"completed" | "inProgress" | "available">("available");

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const lp = loadProgress();
        if (lp && lp.cards) {
          const todayStr = getLocalDateString();
          const cards = Object.values(lp.cards);
          
          const hasCompletedToday = cards.some(
            (card) =>
              card.status === "completed" &&
              card.lastUpdatedAt &&
              getLocalDateString(new Date(card.lastUpdatedAt)) === todayStr
          );
          
          if (hasCompletedToday) {
            setLpStatus("completed");
            return;
          }

          const hasInProgressToday = cards.some(
            (card) =>
              (card.status === "viewed" || card.status === "attempted" || card.status === "recorded") &&
              card.lastUpdatedAt &&
              getLocalDateString(new Date(card.lastUpdatedAt)) === todayStr
          );
          
          if (hasInProgressToday) {
            setLpStatus("inProgress");
            return;
          }
        }
      } catch (e) {
        console.error("Failed to load learning path progress for quests", e);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const todayStr = getLocalDateString();
  const eventsToday = xpEvents ? xpEvents.filter((e) => e.localDate === todayStr) : [];

  const normalSessionCompletedToday = eventsToday.some(
    (e) => e.type === "normal_session_completed"
  );
  const vocabRecallCompletedToday = eventsToday.some(
    (e) => e.type === "vocab_recall_session_completed"
  );
  const articleCompletedToday = eventsToday.some(
    (e) => e.type === "article_practice_completed"
  );
  const weeklyReviewCompletedToday = eventsToday.some(
    (e) => e.type === "weekly_review_completed"
  );

  const quests = [
    {
      id: "lp",
      title: t("progress.quests.lp.title"),
      desc: t("progress.quests.lp.desc"),
      status: lpStatus,
      xpHint: null,
      view: "learning-path",
    },
    {
      id: "speaking",
      title: t("progress.quests.speaking.title"),
      desc: t("progress.quests.speaking.desc"),
      status: normalSessionCompletedToday ? "completed" : "available",
      xpHint: "+40 XP",
      view: "active",
    },
    {
      id: "vocab",
      title: t("progress.quests.vocab.title"),
      desc: t("progress.quests.vocab.desc"),
      status: vocabRecallCompletedToday ? "completed" : "available",
      xpHint: "+20 XP",
      view: "vocabulary",
    },
    {
      id: "article",
      title: t("progress.quests.article.title"),
      desc: t("progress.quests.article.desc"),
      status: articleCompletedToday ? "completed" : "available",
      xpHint: "+25 XP",
      view: "article-practice",
    },
    {
      id: "weekly",
      title: t("progress.quests.weekly.title"),
      desc: t("progress.quests.weekly.desc"),
      status: weeklyReviewCompletedToday
        ? "completed"
        : sessionsCount < 4
        ? "locked"
        : "available",
      xpHint: "+35 XP",
      view: "weekly-review",
    },
    {
      id: "claim",
      title: t("progress.quests.claim.title"),
      desc: t("progress.quests.claim.desc"),
      status: alreadyClaimedToday
        ? "completed"
        : claimableXp > 0
        ? "available"
        : "comeBackLater",
      xpHint: claimableXp > 0 ? `+${claimableXp} XP` : null,
      view: null,
    },
  ];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t("progress.quests.completed") || "Completed";
      case "inProgress":
        return t("progress.quests.inProgress") || "In Progress";
      case "available":
        return t("progress.quests.available") || "Available";
      case "locked":
        return t("progress.quests.locked") || "Locked";
      case "comeBackLater":
        return t("progress.quests.comeBackLater") || "Come back later";
      case "optional":
        return t("progress.quests.optional") || "Optional";
      default:
        return status;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
      case "inProgress":
        return "bg-sky-500/10 text-sky-600 border border-sky-500/20";
      case "available":
        return "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] border border-[var(--brand-teal)]/20";
      case "locked":
        return "bg-gray-500/10 text-gray-400 border border-gray-500/20 opacity-60";
      case "comeBackLater":
        return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
      case "optional":
        return "bg-purple-500/10 text-purple-600 border border-purple-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
    }
  };

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

      <div className="mt-8 border-t border-[var(--brand-border)] pt-6" data-testid="daily-quests-section">
        <h3 className="text-lg font-semibold text-[var(--brand-ink)]">
          {t("progress.quests.title")}
        </h3>
        <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
          {t("progress.quests.subtitle")}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {quests.map((quest) => {
            const statusLabel = getStatusLabel(quest.status);
            const statusStyle = getStatusBadgeStyle(quest.status);

            return (
              <div
                key={quest.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 shadow-sm transition-all duration-200 hover:border-[var(--brand-border)]"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--brand-ink)]">
                      {quest.title}
                    </span>
                    {quest.xpHint && (
                      <span className="rounded bg-[var(--brand-gold-soft)] border border-[var(--brand-gold)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-ink)]">
                        {quest.xpHint}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--brand-ink-soft)]">
                    {quest.desc}
                  </p>
                </div>

                {onSelectView && quest.view && quest.status !== "completed" && quest.status !== "locked" && (
                  <div className="mt-3 sm:mt-0 flex justify-end">
                    <button
                      onClick={() => onSelectView(quest.view as SidebarView)}
                      className="rounded-lg bg-[var(--brand-teal-soft)] hover:bg-[var(--brand-surface-2)] text-[var(--brand-teal-ink)] border border-[var(--brand-teal)]/20 px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                    >
                      {t("progress.quests.go")} ➔
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
