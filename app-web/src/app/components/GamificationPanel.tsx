import { useState, useEffect } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import type { SpeakerLevelProgress, XpProfile, XpEvent } from "../lib/gamification";
import { XP_RULES, getLocalDateString } from "../lib/gamification";
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

  const podchatCompletedToday = eventsToday.some(
    (e) =>
      e.type === "podchat_beginner_evaluated" ||
      e.type === "podchat_intermediate_evaluated" ||
      e.type === "podchat_advanced_evaluated" ||
      e.type === "podchat_expert_evaluated" ||
      e.type === "normal_session_completed"
  );
  const vocabRecallCompletedToday = eventsToday.some(
    (e) => e.type === "vocab_recall_session_completed"
  );
  const articleCompletedToday = eventsToday.some(
    (e) =>
      e.type === "article_essay_evaluated" ||
      e.type === "podchat_context_bonus" ||
      e.type === "article_practice_completed"
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
      status: podchatCompletedToday ? "completed" : "available",
      xpHint: `+${XP_RULES.podchat_intermediate_evaluated.xp} XP`,
      view: "active",
    },
    {
      id: "vocab",
      title: t("progress.quests.vocab.title"),
      desc: t("progress.quests.vocab.desc"),
      status: vocabRecallCompletedToday ? "completed" : "available",
      xpHint: `+${XP_RULES.vocab_recall_session_completed.xp} XP`,
      view: "vocabulary",
    },
    {
      id: "article",
      title: t("progress.quests.article.title"),
      desc: t("progress.quests.article.desc"),
      status: articleCompletedToday ? "completed" : "available",
      xpHint: `+${XP_RULES.article_essay_evaluated.xp} XP`,
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
      xpHint: `+${XP_RULES.weekly_review_completed.xp} XP`,
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
        return "app-status app-status-success";
      case "inProgress":
        return "app-status app-status-info";
      case "available":
        return "app-status app-status-info";
      case "locked":
        return "app-status opacity-70";
      case "comeBackLater":
        return "app-status app-status-warning";
      case "optional":
        return "app-status";
      default:
        return "app-status";
    }
  };

  return (
    <div className="app-panel-muted border-l-4 border-l-[var(--brand-gold)] p-5">
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
        <div className="app-panel px-4 py-3">
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
        <div className="app-panel mt-5 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            {t("game.earnedBadges")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {earnedBadgeLabels.map((label) => (
              <span key={label} className="app-status app-status-warning">
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
                className="app-panel flex flex-col p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--brand-ink)]">
                      {quest.title}
                    </span>
                    {quest.xpHint && (
                      <span className="app-status app-status-warning px-1.5 py-0.5 text-[10px]">
                        {quest.xpHint}
                      </span>
                    )}
                    <span className={`${statusStyle} text-[10px] uppercase tracking-wider`}>
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
                      className="app-button app-button-secondary min-h-9 px-3 py-1.5 text-xs"
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
    <div className="app-panel p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--brand-ink)]">
        {value}
      </p>
    </div>
  );
}
