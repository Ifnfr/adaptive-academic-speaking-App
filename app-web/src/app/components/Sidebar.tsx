import { ReactNode, useState, useEffect } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";

export type SidebarView =
  | "active"
  | "vocabulary"
  | "commonplace"
  | "article-practice"
  | "session-log"
  | "progress"
  | "weekly-review"
  | "diagnostic"
  | "mental-model"
  | "settings"
  | "leaderboard"
  | "learning-path"
  | "profile"
  | "listening"
  | "drill";

export type SidebarProps = {
  view: SidebarView;
  level: string;
  sessionsCount: number;
  dayStreak: number;
  levelPhase: string;
  nextLevel: string | null;
  speakerLevel: number;
  speakerLevelName: string;
  totalXp: number;
  gamificationReady: boolean;
  appLanguage?: AppLanguage | null;
  onSelectView: (view: SidebarView) => void;
  activeSessionPanel?: "podchat" | "patternDrill";
};

type SidebarGroupProps = {
  label: string;
  children: ReactNode;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
};

function SidebarGroup({
  label,
  children,
  collapsible = false,
  isCollapsed = false,
  onToggle,
}: SidebarGroupProps) {
  return (
    <div className="px-2 py-2">
      <div
        className={`flex items-center justify-between px-3 pb-1 ${
          collapsible ? "cursor-pointer select-none" : ""
        }`}
        onClick={collapsible ? onToggle : undefined}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
          {label}
        </p>
        {collapsible && (
          <button
            type="button"
            className="text-[var(--brand-muted)] hover:text-[var(--brand-ink)] focus:outline-none"
            aria-label={isCollapsed ? "Expand group" : "Collapse group"}
          >
            <svg
              className={`h-3.5 w-3.5 transform transition-transform duration-200 ${
                isCollapsed ? "-rotate-90" : "rotate-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}
      </div>
      <ul
        className={`flex flex-col transition-all duration-200 overflow-hidden ${
          isCollapsed ? "max-h-0" : "max-h-[500px]"
        }`}
      >
        {children}
      </ul>
    </div>
  );
}

type SidebarItemProps = {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function SidebarItem({ active = false, onClick, children }: SidebarItemProps) {
  const base =
    "app-button w-full justify-start px-3 py-2 text-left";
  const activeClass =
    "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] font-medium";
  const idleClass = "app-button-ghost text-[var(--brand-ink-soft)]";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`${base} ${active ? activeClass : idleClass}`}
      >
        {children}
      </button>
    </li>
  );
}

export function Sidebar({
  view,
  level,
  sessionsCount,
  dayStreak,
  levelPhase,
  nextLevel,
  speakerLevel,
  speakerLevelName,
  totalXp,
  gamificationReady,
  appLanguage,
  onSelectView,
  activeSessionPanel,
}: SidebarProps) {
  const { t } = useI18n(appLanguage);
  const card = "app-panel brand-grid";

  // Viewport tracking for mobile collapsibility
  const [isMobile, setIsMobile] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isMobile) {
      const storedTools = window.localStorage.getItem("sidebar_tools_expanded");
      setToolsExpanded(storedTools === "true"); // default to false if null/anything else

      const storedAnalytics = window.localStorage.getItem("sidebar_analytics_expanded");
      setAnalyticsExpanded(storedAnalytics === "true"); // default to false if null/anything else
    } else {
      setToolsExpanded(true);
      setAnalyticsExpanded(true);
    }
  }, [isMobile]);

  const toggleTools = () => {
    if (!isMobile) return;
    setToolsExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebar_tools_expanded", String(next));
      return next;
    });
  };

  const toggleAnalytics = () => {
    if (!isMobile) return;
    setAnalyticsExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebar_analytics_expanded", String(next));
      return next;
    });
  };

  return (
    <aside className="lg:h-screen lg:w-[252px] lg:flex-shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-[var(--brand-border)] lg:bg-[var(--brand-bg)] lg:p-4 [scrollbar-width:thin]">
      <div className="flex flex-col gap-4">
        {/* Brand */}
        <div className={card}>
          <div className="flex flex-col items-start gap-3 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fonetik_logo.png"
              alt="fonetik logo"
              className="block h-auto w-full max-w-[220px] object-contain"
            />
            <div>
              <p className="text-sm font-semibold tracking-tight text-[var(--brand-teal-ink)]">
                {t("sidebar.speakBetter")}
              </p>
              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                {t("sidebar.tagline")}
              </p>
            </div>
          </div>
        </div>

        {/* Current level */}
        <div
          className="overflow-hidden rounded-2xl border border-[var(--brand-level-card-border)] bg-[var(--brand-level-card-bg)] text-[var(--brand-level-card-text)] shadow-sm"
          data-testid="sidebar-current-level-card"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {t("sidebar.currentLevel")}
            </p>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white/80">
              {sessionsCount === 0 ? t("sidebar.day1") : `${sessionsCount} ${sessionsCount === 1 ? t("sidebar.sessionCount") : t("sidebar.sessionsCount")}`}
            </span>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-semibold tracking-tight">{level}</p>
            <p className="mt-1 text-xs text-white/70">
              {levelPhase}
            </p>
            {nextLevel && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/85">
                {nextLevel}
              </p>
            )}
            <p className="mt-3 text-xs text-white/60">
              {t("sidebar.adjustSetup")}
            </p>
          </div>
        </div>

        {/* Speaker level */}
        <div className={card}>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                {t("sidebar.speakerLevel")}
              </p>
              <span className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                {t("sidebar.xp")}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--brand-ink)]">
              {gamificationReady ? `Level ${speakerLevel}` : "Level -"}
            </p>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              {gamificationReady ? speakerLevelName : t("sidebar.loadingSpeaker")}
            </p>
            <p className="mt-3 font-mono text-xs tabular-nums text-[var(--brand-muted)]">
              {gamificationReady ? `${totalXp} ${t("sidebar.totalXp")}` : `- ${t("sidebar.totalXp")}`}
            </p>
            <p className="mt-2 text-xs text-[var(--brand-muted)]">
              {t("sidebar.separateLevel")}
            </p>
          </div>
        </div>

        {/* Grouped nav */}
        <nav className={card} aria-label="Sections">
          {/* Group 1: PRACTICE */}
          <SidebarGroup label={t("sidebar.groupPractice")}>
            <SidebarItem
              active={view === "active" && activeSessionPanel !== "patternDrill"}
              onClick={() => onSelectView("active")}
            >
              {t("sidebar.viewActive")}
            </SidebarItem>
            <SidebarItem
              active={view === "active" && activeSessionPanel === "patternDrill"}
              onClick={() => onSelectView("drill")}
            >
              {t("sidebar.viewDrillMode" as any) || "Drill Mode"}
            </SidebarItem>
            <SidebarItem
              active={view === "listening"}
              onClick={() => onSelectView("listening")}
            >
              {t("sidebar.viewListening") || "Listening"}
            </SidebarItem>
          </SidebarGroup>

          {/* Group 2: TOOLS */}
          <SidebarGroup
            label={t("sidebar.groupTools" as any) || "Tools"}
            collapsible={isMobile}
            isCollapsed={isMobile && !toolsExpanded}
            onToggle={toggleTools}
          >
            <SidebarItem
              active={view === "vocabulary"}
              onClick={() => onSelectView("vocabulary")}
            >
              {t("sidebar.viewVocabulary")}
            </SidebarItem>
            <SidebarItem
              active={view === "commonplace"}
              onClick={() => onSelectView("commonplace")}
            >
              {t("sidebar.viewCommonplace")}
            </SidebarItem>
            <SidebarItem
              active={view === "article-practice"}
              onClick={() => onSelectView("article-practice")}
            >
              {t("sidebar.viewArticlePractice")}
            </SidebarItem>
          </SidebarGroup>

          {/* Group 3: ANALYTICS */}
          <SidebarGroup
            label={t("sidebar.groupAnalytics")}
            collapsible={isMobile}
            isCollapsed={isMobile && !analyticsExpanded}
            onToggle={toggleAnalytics}
          >
            <SidebarItem
              active={view === "session-log"}
              onClick={() => onSelectView("session-log")}
            >
              {t("sidebar.viewSessionLog")}
            </SidebarItem>
            <SidebarItem
              active={view === "progress"}
              onClick={() => onSelectView("progress")}
            >
              {t("sidebar.viewProgress")}
            </SidebarItem>
            {/*
            <SidebarItem
              active={view === "weekly-review"}
              onClick={() => onSelectView("weekly-review")}
            >
              {t("sidebar.viewWeeklyReview")}
            </SidebarItem>
            */}
            <SidebarItem
              active={view === "profile"}
              onClick={() => onSelectView("profile")}
            >
              {t("sidebar.viewProfile")}
            </SidebarItem>
            <SidebarItem
              active={view === "leaderboard"}
              onClick={() => onSelectView("leaderboard")}
            >
              {t("sidebar.viewLeaderboard")}
            </SidebarItem>
            <SidebarItem
              active={view === "settings"}
              onClick={() => onSelectView("settings")}
            >
              {t("sidebar.viewSettings")}
            </SidebarItem>
          </SidebarGroup>
        </nav>

        {/* Day Streak (motivational, sidebar lower area) */}
        <div className={card}>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                {t("sidebar.dayStreak")}
              </p>
              <span className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                {t("sidebar.local")}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
                {dayStreak}
              </p>
              <p className="text-xs text-[var(--brand-ink-soft)]">
                {dayStreak === 1 ? "day" : "days"}
              </p>
            </div>
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              {dayStreak === 0
                ? t("sidebar.streakStart")
                : t("sidebar.streakKeep")}
            </p>
            <p className="mt-3 text-xs text-[var(--brand-muted)]">
              {sessionsCount}{" "}
              {sessionsCount === 1 ? t("sidebar.sessionCount") : t("sidebar.sessionsCount")}{" "}
              {t("sidebar.storedLocally")} · {t("sidebar.max20")}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
