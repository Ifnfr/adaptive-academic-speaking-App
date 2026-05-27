import type { ReactNode } from "react";

type TopbarProps = {
  subtitle: string;
  title: string;
  description: string;
  hasActiveSession: boolean;
  mode: string;
  level: string;
  authSlot?: ReactNode;
};

export function Topbar({
  subtitle,
  title,
  description,
  hasActiveSession,
  mode,
  level,
  authSlot,
}: TopbarProps) {
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";

  return (
    <header
      className={`${card} sticky top-2 z-10 flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between`}
    >
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-teal)]">
          fonetik · {subtitle}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--brand-ink)]">
          {title}
        </h1>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-ink-soft)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-teal)]" />
          {hasActiveSession ? "Session active" : "Idle"}
        </span>
        <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-ink-soft)]">
          {mode}
        </span>
        <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-ink-soft)]">
          {level}
        </span>
        {authSlot}
      </div>
    </header>
  );
}
