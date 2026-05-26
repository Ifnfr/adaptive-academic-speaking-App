type CoachRecommendationForPanel = {
  hasHistory: boolean;
  focus: string;
  recommendedMode: string;
  recommendedSessionType: string;
  reason: string;
  nextAction: string;
};

type PreviousSessionForPanel = {
  date: string;
  mainWeakness: string;
  retryTask: string;
};

type CoachPanelsProps = {
  coachRecommendation: CoachRecommendationForPanel;
  previousSession: PreviousSessionForPanel | null;
  onUseRecommendation: () => void;
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

export function CoachPanels({
  coachRecommendation,
  previousSession,
  onUseRecommendation,
}: CoachPanelsProps) {
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
  const cardHeader =
    "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Coach Recommendation */}
      <section
        className={`${card} border-l-4 border-l-[var(--brand-teal)]`}
      >
        <div className={cardHeader}>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                Coach
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                Coach Recommendation
              </h2>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-[var(--brand-muted)]">
              Local · No AI call
            </span>
          </div>
        </div>
        <div className={cardBody}>
          <p className="mb-4 text-sm text-[var(--brand-ink-soft)]">
            {coachRecommendation.hasHistory
              ? "Based on your last session, here is a focused starting point. You can apply it or override anything."
              : "Complete one session to personalize future recommendations. Until then, here is a beginner-friendly starting point."}
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <SummaryCell
              label="Focus"
              value={coachRecommendation.focus}
              multiline
            />
            <SummaryCell
              label="Mode"
              value={coachRecommendation.recommendedMode}
            />
            <SummaryCell
              label="Session Type"
              value={coachRecommendation.recommendedSessionType}
            />
            <SummaryCell
              label="Next Action"
              value={coachRecommendation.nextAction}
              multiline
            />
            <div className="sm:col-span-2">
              <SummaryCell
                label="Reason"
                value={coachRecommendation.reason}
                multiline
              />
            </div>
          </dl>
          <div className="mt-5">
            <button
              type="button"
              onClick={onUseRecommendation}
              className={buttonSecondary}
            >
              Use Recommendation
            </button>
          </div>
        </div>
      </section>

      {/* Previous Weakness */}
      {previousSession && (
        <section
          className={`${card} border-l-4 border-l-[var(--brand-gold)]`}
        >
          <div className={cardHeader}>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
              Spaced repetition
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
              Previous weakness
            </h2>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              From your last session on {previousSession.date}. Leave
              Today&apos;s Target empty to carry it forward automatically.
            </p>
          </div>
          <div className={cardBody}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3">
              <SummaryCell
                label="Main Weakness"
                value={previousSession.mainWeakness}
                multiline
              />
              <SummaryCell
                label="Next Target"
                value={previousSession.retryTask}
                multiline
              />
            </dl>
          </div>
        </section>
      )}
    </div>
  );
}
