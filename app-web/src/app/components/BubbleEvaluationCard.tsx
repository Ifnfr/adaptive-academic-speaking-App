import type { PodchatBubbleEvaluation } from "../api/podchat/evaluate-bubbles/route";

export interface BubbleEvaluationCardProps {
  turnId: string;
  learnerText: string;
  evaluation: PodchatBubbleEvaluation | null;
  loading: boolean;
  error: string | null;
  onEvaluate: () => void;
}

const statusTone: Record<
  PodchatBubbleEvaluation["status"],
  { label: string; className: string }
> = {
  excellent: { label: "Excellent", className: "app-status app-status-success" },
  good: { label: "Good", className: "app-status app-status-info" },
  needs_improvement: {
    label: "Needs improvement",
    className: "app-status app-status-warning",
  },
};

export function BubbleEvaluationCard({
  turnId,
  learnerText,
  evaluation,
  loading,
  error,
  onEvaluate,
}: BubbleEvaluationCardProps) {
  return (
    <div
      className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4"
      data-testid={`bubble-evaluation-${turnId}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
            Bubble feedback
          </p>
          {evaluation && (
            <span
              className={statusTone[evaluation.status].className}
              data-testid={`bubble-evaluation-status-${turnId}`}
            >
              {statusTone[evaluation.status].label}
            </span>
          )}
          {evaluation !== null && (
            <span
              className="text-xs font-semibold text-[var(--brand-ink-soft)]"
              data-testid={`bubble-evaluation-score-${turnId}`}
            >
              {evaluation.score}/100
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onEvaluate}
          disabled={loading}
          className="app-button app-button-secondary min-h-9 px-3 py-1.5 text-xs"
          data-testid={`bubble-evaluate-btn-${turnId}`}
        >
          {loading ? "Evaluating..." : evaluation ? "Re-evaluate" : "Evaluate"}
        </button>
      </div>

      <div className="mt-3 text-sm leading-6 text-[var(--brand-ink-soft)] italic">
        "{learnerText}"
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--brand-teal)]">
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-[var(--brand-teal)] border-t-transparent"></div>
          <span>Analyzing this bubble...</span>
        </div>
      )}

      {error && (
        <div
          className="app-message app-message-error mt-3 text-xs"
          data-testid={`bubble-evaluation-error-${turnId}`}
        >
          {error}
        </div>
      )}

      {evaluation && !loading && (
        <div className="mt-3 flex flex-col gap-3">
          <p
            className="text-sm leading-6 text-[var(--brand-ink)]"
            data-testid={`bubble-evaluation-message-${turnId}`}
          >
            {evaluation.message}
          </p>

          {evaluation.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
                Strengths
              </p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm leading-6 text-[var(--brand-ink-soft)]">
                {evaluation.strengths.map((s, i) => (
                  <li key={`${turnId}-s-${i}`} data-testid={`bubble-strength-${turnId}-${i}`}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.improvements.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-coral)]">
                Improvements
              </p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm leading-6 text-[var(--brand-ink-soft)]">
                {evaluation.improvements.map((imp, i) => (
                  <li key={`${turnId}-i-${i}`} data-testid={`bubble-improvement-${turnId}-${i}`}>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
            <p
              className="text-sm leading-6 text-[var(--brand-ink)]"
              data-testid={`bubble-suggestion-${turnId}`}
            >
              <span className="font-semibold">Next step: </span>
              {evaluation.suggestion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}