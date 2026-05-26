import type { ReactNode } from "react";

export type SidebarView =
  | "active"
  | "session-log"
  | "progress"
  | "weekly-review"
  | "diagnostic"
  | "mental-model"
  | "settings";

type SidebarProps = {
  view: SidebarView;
  level: string;
  mode: string;
  sessionsCount: number;
  dayStreak: number;
  levelPhase: string;
  nextLevel: string | null;
  speakerLevel: number;
  speakerLevelName: string;
  totalXp: number;
  onSelectView: (view: SidebarView) => void;
  onSelectDiagnostic: () => void;
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
    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]";
  const activeClass =
    "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] font-medium";
  const idleClass =
    "text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface-2)] hover:text-[var(--brand-ink)]";
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
  mode,
  sessionsCount,
  dayStreak,
  levelPhase,
  nextLevel,
  speakerLevel,
  speakerLevelName,
  totalXp,
  onSelectView,
  onSelectDiagnostic,
}: SidebarProps) {
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";

  return (
    <aside className="lg:w-[252px] lg:flex-shrink-0">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
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
                Speak Better
              </p>
              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                AI-Powered academic speaking practice
              </p>
            </div>
          </div>
        </div>

        {/* Current level */}
        <div className="overflow-hidden rounded-2xl border border-[var(--brand-teal-ink)] bg-[var(--brand-teal-ink)] text-white shadow-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Current Level
            </p>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
              {sessionsCount === 0 ? "Day 1" : `${sessionsCount} sessions`}
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
              Adjust in Session setup.
            </p>
          </div>
        </div>

        {/* Speaker level */}
        <div className={card}>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                Speaker Level
              </p>
              <span className="text-[10px] uppercase tracking-wide text-[var(--brand-muted)]">
                XP
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--brand-ink)]">
              Level {speakerLevel}
            </p>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              {speakerLevelName}
            </p>
            <p className="mt-3 font-mono text-xs tabular-nums text-[var(--brand-muted)]">
              {totalXp} total XP
            </p>
            <p className="mt-2 text-[11px] text-[var(--brand-muted)]">
              Separate from English Level.
            </p>
          </div>
        </div>

        {/* Grouped nav */}
        <nav className={card} aria-label="Sections">
          <SidebarGroup label="Practice">
            <SidebarItem
              active={view === "active"}
              onClick={() => onSelectView("active")}
            >
              Active Session
            </SidebarItem>
            <SidebarItem
              active={view === "session-log"}
              onClick={() => onSelectView("session-log")}
            >
              Session Log
            </SidebarItem>
          </SidebarGroup>

          <SidebarGroup label="Analytics">
            <SidebarItem
              active={view === "progress"}
              onClick={() => onSelectView("progress")}
            >
              Progress
            </SidebarItem>
            <SidebarItem
              active={view === "progress"}
              onClick={() => onSelectView("progress")}
            >
              Level-Up Check
            </SidebarItem>
            <SidebarItem
              active={view === "weekly-review"}
              onClick={() => onSelectView("weekly-review")}
            >
              Weekly Review
            </SidebarItem>
            <SidebarItem
              active={view === "diagnostic" || (view === "active" && mode === "Diagnostic")}
              onClick={onSelectDiagnostic}
            >
              Diagnostic
            </SidebarItem>
          </SidebarGroup>

          <SidebarGroup label="System">
            <SidebarItem
              active={view === "mental-model"}
              onClick={() => onSelectView("mental-model")}
            >
              Mental Model
            </SidebarItem>
            <SidebarItem
              active={view === "settings"}
              onClick={() => onSelectView("settings")}
            >
              Settings
            </SidebarItem>
          </SidebarGroup>
        </nav>

        {/* Day Streak (motivational, sidebar lower area) */}
        <div className={card}>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                Day Streak
              </p>
              <span className="text-[10px] uppercase tracking-wide text-[var(--brand-muted)]">
                Local
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
                ? "Complete a session today to start a streak."
                : "Don't break the chain. Keep practicing daily."}
            </p>
            <p className="mt-3 text-[11px] text-[var(--brand-muted)]">
              {sessionsCount}{" "}
              {sessionsCount === 1 ? "session" : "sessions"} stored locally · max 20
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
