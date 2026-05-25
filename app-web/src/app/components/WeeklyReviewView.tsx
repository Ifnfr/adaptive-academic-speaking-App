export type WeeklyReviewResult = {
  summary: string;
  recurringWeakness: string;
  bestImprovement: string;
  scoreTrend: string;
  nextWeekFocus: string;
  recommendedPlan: string[];
  warnings: string[];
};

type WeeklyReviewViewProps = {
  sessionsCount: number;
  provider: string;
  weeklyReviewResult: WeeklyReviewResult | null;
  weeklyReviewLoading: boolean;
  weeklyReviewError: string | null;
  onRunWeeklyReview: () => void;
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

export function WeeklyReviewView({
  sessionsCount,
  provider,
  weeklyReviewResult,
  weeklyReviewLoading,
  weeklyReviewError,
  onRunWeeklyReview,
}: WeeklyReviewViewProps) {
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
  const cardHeader =
    "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const buttonPrimary =
    "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";

  return (
    <section className={card}>
      <div className={`${cardHeader} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            AI review
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Weekly Review
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            Summarizes your latest practice sessions with the selected provider.
            Results are not stored.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1 text-xs text-[var(--brand-ink-soft)]">
          {Math.min(sessionsCount, 4)}/4 completed sessions
        </span>
      </div>
      <div className={`${cardBody} flex flex-col gap-5`}>
        {sessionsCount < 4 ? (
          <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--brand-ink)]">
              Weekly Review requires at least 4 completed practice sessions.
            </p>
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              Complete {4 - sessionsCount} more session
              {4 - sessionsCount === 1 ? "" : "s"} to unlock this review.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={labelClass}>Ready to review</p>
                <p className="text-sm text-[var(--brand-ink)]">
                  Uses the latest {Math.min(sessionsCount, 7)} session summaries
                  with {provider}.
                </p>
                <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  Transcripts are not sent for this MVP review.
                </p>
              </div>
              <button
                type="button"
                onClick={onRunWeeklyReview}
                disabled={weeklyReviewLoading}
                className={`${buttonPrimary} w-full sm:w-auto`}
              >
                {weeklyReviewLoading
                  ? "Running weekly review..."
                  : "Run Weekly Review"}
              </button>
            </div>
          </div>
        )}

        {weeklyReviewError && (
          <div
            role="alert"
            className="rounded-lg border border-[var(--brand-coral)]/50 bg-[var(--brand-coral-soft)] px-4 py-3 text-sm text-[var(--brand-coral)]"
          >
            <p>{weeklyReviewError}</p>
            <p className="mt-1 text-xs opacity-80">
              You can try again, wait a moment, or switch provider.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onRunWeeklyReview}
                disabled={weeklyReviewLoading || sessionsCount < 4}
                className="rounded-lg border border-[var(--brand-coral)]/60 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-coral)] transition-colors hover:bg-[var(--brand-coral-soft)]/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {weeklyReviewLoading ? "Trying again..." : "Try Again"}
              </button>
            </div>
          </div>
        )}

        {weeklyReviewResult && (
          <div className="rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Weekly review result
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <SummaryCell
                label="Summary"
                value={weeklyReviewResult.summary}
                multiline
              />
              <SummaryCell
                label="Recurring Weakness"
                value={weeklyReviewResult.recurringWeakness}
                multiline
              />
              <SummaryCell
                label="Best Improvement"
                value={weeklyReviewResult.bestImprovement}
                multiline
              />
              <SummaryCell
                label="Score Trend"
                value={weeklyReviewResult.scoreTrend}
                multiline
              />
              <div className="sm:col-span-2">
                <SummaryCell
                  label="Next Week Focus"
                  value={weeklyReviewResult.nextWeekFocus}
                  multiline
                />
              </div>
            </dl>

            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <p className={labelClass}>7-Day Recommended Plan</p>
              <ol className="list-none space-y-1 text-sm text-[var(--brand-ink)]">
                {weeklyReviewResult.recommendedPlan.map((item, i) => (
                  <li key={i} className="break-words">
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            {weeklyReviewResult.warnings.length > 0 && (
              <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                <p className={labelClass}>Warnings</p>
                <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
                  {weeklyReviewResult.warnings.map((warning) => (
                    <li key={warning} className="break-words">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
