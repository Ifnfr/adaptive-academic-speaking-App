type FeedbackForRetryPanels = {
  retryTask: string;
};

type CapturedRetryForPanels = {
  transcript: string;
};

type SessionSummaryForPanels = {
  csv: string;
};

type RetryAndSummaryPanelsProps = {
  feedback: FeedbackForRetryPanels | null;
  isDiagnosticMode: boolean;
  retryTranscript: string;
  canSubmitRetry: boolean;
  capturedRetry: CapturedRetryForPanels | null;
  sessionSummary: SessionSummaryForPanels | null;
  csvCopied: boolean;
  onRetryTranscriptChange: (value: string) => void;
  onSubmitRetry: () => void;
  onEndSession: () => void;
  onCopyCsv: () => void | Promise<void>;
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

export function RetryAndSummaryPanels({
  feedback,
  isDiagnosticMode,
  retryTranscript,
  canSubmitRetry,
  capturedRetry,
  sessionSummary,
  csvCopied,
  onRetryTranscriptChange,
  onSubmitRetry,
  onEndSession,
  onCopyCsv,
}: RetryAndSummaryPanelsProps) {
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
  const cardHeader =
    "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const inputClass =
    "w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-teal)]";
  const buttonPrimary =
    "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";

  if (isDiagnosticMode) return null;

  return (
    <>
      {/* Retry Attempt */}
      {feedback && !capturedRetry && (
        <section className={card}>
          <div className={cardHeader}>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Step 5
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
              Retry attempt
            </h2>
          </div>
          <div className={cardBody}>
            <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3">
              <p className={labelClass}>Retry task</p>
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--brand-ink)]">
                {feedback.retryTask}
              </p>
            </div>

            <div className="mt-5">
              <label htmlFor="retry-transcript" className={labelClass}>
                Retry transcript
              </label>
              <textarea
                id="retry-transcript"
                value={retryTranscript}
                onChange={(e) => onRetryTranscriptChange(e.target.value)}
                rows={8}
                placeholder="Type or paste your retry attempt here..."
                className={`${inputClass} resize-y leading-6`}
              />
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={onSubmitRetry}
                disabled={!canSubmitRetry}
                className={`${buttonPrimary} w-full sm:w-auto`}
              >
                Submit Retry
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Retry Captured */}
      {capturedRetry && (
        <section className={card}>
          <div className={cardHeader}>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Step 6
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
              Retry captured
            </h2>
          </div>
          <div className={cardBody}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4">
              <SummaryCell
                label="Retry transcript preview"
                value={capturedRetry.transcript}
                multiline
              />
            </dl>
            <p className="mt-5 rounded-lg border border-[var(--brand-gold)]/40 bg-[var(--brand-gold-soft)] px-4 py-3 text-sm text-[var(--brand-ink)]">
              Retry saved. You can now end the session.
            </p>
            {!sessionSummary && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onEndSession}
                  className={`${buttonPrimary} w-full sm:w-auto`}
                >
                  End Session
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Session Summary */}
      {sessionSummary && (
        <section className={card}>
          <div className={cardHeader}>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Step 7
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
              Session summary
            </h2>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              CSV row generated. Score columns use AI-generated 1-5 values
              (with safe fallback to 3 when missing).
            </p>
          </div>
          <div className={cardBody}>
            <pre className="overflow-x-auto rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 font-mono text-xs leading-6 text-[var(--brand-ink)]">
              {sessionSummary.csv}
            </pre>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={onCopyCsv}
                className={buttonSecondary}
              >
                Copy CSV
              </button>
              {csvCopied && (
                <span
                  role="status"
                  className="text-xs font-medium text-[var(--brand-teal-ink)]"
                >
                  Copied to clipboard
                </span>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
