import type { ReactNode } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";

type TopbarProps = {
  subtitle: string;
  title: string;
  description: string;
  hasActiveSession: boolean;
  mode: string;
  level: string;
  authSlot?: ReactNode;
  appLanguage?: AppLanguage | null;
};

export function Topbar({
  subtitle,
  title,
  description,
  hasActiveSession,
  mode,
  level,
  authSlot,
  appLanguage,
}: TopbarProps) {
  const { t } = useI18n(appLanguage);
  const card = "app-panel brand-grid";

  return (
    <header
      className={`${card} sticky top-2 z-10 hidden lg:flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between`}
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
        {authSlot}
      </div>
    </header>
  );
}
