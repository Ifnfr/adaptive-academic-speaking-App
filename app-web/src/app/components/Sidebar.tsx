import type { ReactNode } from "react";
import Link from "next/link";
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
  | "listening";

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
};

type SidebarGroupProps = {
  label: string;
  children: ReactNode;
};

function SidebarGroup({ label, children }: SidebarGroupProps) {
  return (
    <div className="px-2 py-2">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
        {label}
      </p>
      <ul className="flex flex-col">{children}</ul>
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

type SidebarLinkProps = {
  active?: boolean;
  href: string;
  children: ReactNode;
};

function SidebarLink({ active = false, href, children }: SidebarLinkProps) {
  const base =
    "app-button w-full justify-start px-3 py-2 text-left flex items-center";
  const activeClass =
    "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] font-medium";
  const idleClass = "app-button-ghost text-[var(--brand-ink-soft)]";
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`${base} ${active ? activeClass : idleClass}`}
      >
        {children}
      </Link>
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
}: SidebarProps) {
  const { t } = useI18n(appLanguage);
  const card = "app-panel brand-grid";

  return (
    <aside className="lg:h-screen lg:w-[252px] lg:flex-shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-[var(--brand-border)] lg:bg-[var(--brand-bg)] lg:p-4 [scrollbar-width:thin]">
      <div className="flex flex-col gap-4">
        {/* Brand */}
        <div className={card}>
          <div className="flex flex-col items-start gap-3 p-5">
            {/* Horizontal PNG wordmark. Width-based sizing keeps the
                aspect ratio intact regardless of the file's pixel
                dimensions. */}
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              {t("sidebar.currentLevel")}
            </p>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
              {sessionsCount === 0 ? t("sidebar.day1") : `${sessionsCount} ${sessionsCount === 1 ? t("sidebar.sessionCount") : t("sidebar.sessionsCount")}`}
            </span>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-semibold tracking-tight">{level}</p>
            <p className="mt-1 text-xs text-white/70">
              {levelPhase}
            </p>
            {nextLevel && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/85">
                {nextLevel}
              </p>
            )}
            <p className="mt-3 text-[11px] text-white/60">
              {t("sidebar.adjustSetup")}
            </p>
          </div>
        </div>

        {/* Speaker level */}
        <div className={card}>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                {t("sidebar.speakerLevel")}
              </p>
              <span className="text-[10px] uppercase tracking-wide text-[var(--brand-muted)]">
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
            <p className="mt-2 text-[11px] text-[var(--brand-muted)]">
              {t("sidebar.separateLevel")}
            </p>
          </div>
        </div>

        {/* Grouped nav */}
        <nav className={card} aria-label="Sections">
          <SidebarGroup label={t("sidebar.groupPractice")}>
            <SidebarItem
              active={view === "active"}
              onClick={() => onSelectView("active")}
            >
              {t("sidebar.viewActive")}
            </SidebarItem>
            <SidebarLink
              active={view === "listening"}
              href="/listening"
            >
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 flex-shrink-0"
                >
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
                <span>{t("sidebar.viewListening") || "Listening"}</span>
              </div>
            </SidebarLink>
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
            <SidebarItem
              active={view === "session-log"}
              onClick={() => onSelectView("session-log")}
            >
              {t("sidebar.viewSessionLog")}
            </SidebarItem>
          </SidebarGroup>

          <SidebarGroup label={t("sidebar.groupAnalytics")}>
            <SidebarItem
              active={view === "progress"}
              onClick={() => onSelectView("progress")}
            >
              {t("sidebar.viewProgress")}
            </SidebarItem>
            <SidebarItem
              active={view === "weekly-review"}
              onClick={() => onSelectView("weekly-review")}
            >
              {t("sidebar.viewWeeklyReview")}
            </SidebarItem>
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
          </SidebarGroup>

          <SidebarGroup label={t("sidebar.groupSystem")}>
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
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                {t("sidebar.dayStreak")}
              </p>
              <span className="text-[10px] uppercase tracking-wide text-[var(--brand-muted)]">
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
            <p className="mt-3 text-[11px] text-[var(--brand-muted)]">
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
