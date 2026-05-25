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
  onCopyLastCsv,
  onGoToActiveSession,
}: SessionLogViewProps) {
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
            History
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Session Log
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            {sessions.length === 0
              ? "No sessions stored yet. Complete one from Active Session to populate this log."
              : `Showing the ${Math.min(sessions.length, 5)} most recent of ${sessions.length} stored.`}
          </p>
        </div>
        {sessions.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCopyLastCsv}
              className={buttonSecondary}
            >
              Copy Last CSV
            </button>
            {lastCsvCopied && (
              <span
                role="status"
                className="text-xs font-medium text-[var(--brand-teal-ink)]"
              >
                Copied
              </span>
            )}
          </div>
        )}
      </div>
      <div className={cardBody}>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center">
            <p className="text-sm text-[var(--brand-ink-soft)]">
              Your completed sessions will appear here.
            </p>
            <button
              type="button"
              onClick={onGoToActiveSession}
              className={`${buttonSecondary} mt-4`}
            >
              Go to Active Session
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.slice(0, 5).map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4"
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
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <SummaryCell
                    label="Main Weakness"
                    value={s.mainWeakness}
                    multiline
                  />
                  <SummaryCell
                    label="Next Target"
                    value={s.retryTask}
                    multiline
                  />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
