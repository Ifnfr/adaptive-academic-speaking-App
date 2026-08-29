import { useEffect, useState } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";

type SessionLogSession = {
  id: string;
  date: string;
  level: string;
  mode: string;
  mainWeakness: string;
  retryTask: string;
};

type SessionLogViewProps = {
  sessions: SessionLogSession[];
  lastCsvCopied: boolean;
  appLanguage?: AppLanguage | null;
  onCopyLastCsv: () => void | Promise<void>;
  onGoToActiveSession: () => void;
};

function SummaryCell({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </dt>
      <dd
        className={
          multiline
            ? "whitespace-pre-wrap break-words text-sm text-[var(--brand-ink)]"
            : "text-sm text-[var(--brand-ink)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function SessionLogView({
  sessions,
  lastCsvCopied,
  appLanguage,
  onCopyLastCsv,
  onGoToActiveSession,
}: SessionLogViewProps) {
  const { t } = useI18n(appLanguage);
  
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    const isDesktop = window.innerWidth >= 1024;
    if (isDesktop && sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
  const cardHeader =
    "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className={card}>
      <div className={`${cardHeader} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            {t("log.history")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("log.title")}
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            {sessions.length === 0
              ? t("log.taglineEmpty")
              : `${t("log.taglineShowing")} ${Math.min(sessions.length, 5)} ${t("log.taglineOf")} ${sessions.length} ${t("log.taglineStored")}`}
          </p>
        </div>
        {sessions.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCopyLastCsv}
              className={buttonSecondary}
            >
              {t("log.copyCsvBtn")}
            </button>
            {lastCsvCopied && (
              <span
                role="status"
                className="text-xs font-medium text-[var(--brand-teal-ink)]"
              >
                {t("log.copied")}
              </span>
            )}
          </div>
        )}
      </div>
      <div className={cardBody}>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center">
            <p className="text-sm text-[var(--brand-ink-soft)]">
              {t("log.emptyMessage")}
            </p>
            <button
              type="button"
              onClick={onGoToActiveSession}
              className={`${buttonSecondary} mt-4`}
            >
              {t("log.goToActive")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Session List (2/5 proportion -> lg:col-span-5) */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <ul className="flex flex-col gap-3">
                {sessions.slice(0, 5).map((s) => (
                  <li
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                      selectedSessionId === s.id
                        ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]"
                        : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] hover:bg-[var(--brand-surface-3)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--brand-ink-soft)]">
                      <span className="font-mono text-[var(--brand-ink)]">
                        {s.date}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{s.level}</span>
                      <span aria-hidden="true">·</span>
                      <span>{s.mode}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
                      <SummaryCell
                        label={t("log.mainWeakness")}
                        value={s.mainWeakness}
                        multiline
                      />
                      <SummaryCell
                        label={t("log.nextTarget")}
                        value={s.retryTask}
                        multiline
                      />
                    </dl>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Detail Panel (3/5 proportion -> lg:col-span-7) */}
            {selectedSession && (
              <div className="hidden lg:block lg:col-span-7 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 shadow-sm self-start">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-teal)]">
                      Session Details
                    </p>
                    <h3 className="mt-1.5 text-lg font-bold text-[var(--brand-ink)]">
                      {selectedSession.date}
                    </h3>
                  </div>

                  <div className="border-t border-[var(--brand-border)] pt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--brand-ink-soft)] font-medium">Mode</span>
                      <span className="font-semibold text-[var(--brand-ink)]">
                        {selectedSession.mode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--brand-ink-soft)] font-medium">Level</span>
                      <span className="font-semibold text-[var(--brand-ink)]">
                        {selectedSession.level}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[var(--brand-border)] pt-4 flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
                      {t("log.mainWeakness")}
                    </p>
                    <p className="text-sm text-[var(--brand-ink)] whitespace-pre-wrap leading-relaxed">
                      {selectedSession.mainWeakness}
                    </p>
                  </div>

                  <div className="border-t border-[var(--brand-border)] pt-4 flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
                      {t("log.nextTarget")}
                    </p>
                    <p className="text-sm text-[var(--brand-ink)] whitespace-pre-wrap leading-relaxed">
                      {selectedSession.retryTask}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
