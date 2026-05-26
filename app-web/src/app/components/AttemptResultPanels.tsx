type ScoreKey =
  | "fluency"
  | "grammar"
  | "vocabulary"
  | "coherence"
  | "argument"
  | "academicTone";

type AttemptLevel =
  | "Foundation"
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Expert";

type CapturedAttemptForPanels = {
  transcript: string;
  durationSeconds: number;
};

type FeedbackForPanels = {
  mainWeakness: string;
  evidence: string;
  betterPhrase: string;
  retryTask: string;
  providerUsed: string;
  scores?: Partial<Record<ScoreKey, number>>;
};

type DiagnosticResultForPanels = {
  recommendedLevel: string;
  mainBottleneck: string;
  summary: string;
  scores: Record<ScoreKey, number>;
  sevenDayFocusPlan: string[];
};

type AttemptResultPanelsProps = {
  capturedAttempt: CapturedAttemptForPanels;
  activeLevel: AttemptLevel | null;
  isDiagnosticMode: boolean;
  feedback: FeedbackForPanels | null;
  feedbackLoading: boolean;
  feedbackError: string | null;
  diagnosticResult: DiagnosticResultForPanels | null;
  diagnosticLoading: boolean;
  diagnosticError: string | null;
  onGetFeedback: () => void;
  onRunDiagnostic: () => void;
  onApplyRecommendedLevel: () => void;
};

const SCORE_LABELS: Record<ScoreKey, string> = {
  fluency: "Fluency",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  coherence: "Coherence",
  argument: "Argument",
  academicTone: "Academic Tone",
};

function scoreKeysForLevel(level: AttemptLevel): readonly ScoreKey[] {
  if (level === "Foundation") return ["fluency", "coherence"];
  if (level === "Beginner") return ["fluency", "grammar", "coherence"];
  return [
    "fluency",
    "grammar",
    "vocabulary",
    "coherence",
    "argument",
    "academicTone",
  ];
}

function safeScore(value: unknown): number {
  const fallback = 3;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  const r = Math.round(n);
  if (r < 1) return 1;
  if (r > 5) return 5;
  return r;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function SummaryCell({
  label,
  value,
  multiline = false,
  mono = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </dt>
      <dd
        className={
          (multiline
            ? "whitespace-pre-wrap break-words text-sm text-[var(--brand-ink)]"
            : "text-sm text-[var(--brand-ink)]") +
          (mono ? " font-mono tabular-nums" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function AttemptResultPanels({
  capturedAttempt,
  activeLevel,
  isDiagnosticMode,
  feedback,
  feedbackLoading,
  feedbackError,
  diagnosticResult,
  diagnosticLoading,
  diagnosticError,
  onGetFeedback,
  onRunDiagnostic,
  onApplyRecommendedLevel,
}: AttemptResultPanelsProps) {
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
  const cardHeader =
    "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const buttonPrimary =
    "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";
  const errorButtonClass =
    "rounded-lg border border-[var(--brand-coral)]/60 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-coral)] transition-colors hover:bg-[var(--brand-coral-soft)]/60 disabled:cursor-not-allowed disabled:opacity-50";

  const wordCount = String(
    capturedAttempt.transcript.split(/\s+/).filter(Boolean).length,
  );

  return (
    <section className={card}>
      <div className={cardHeader}>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
          Step 4
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          Attempt captured
        </h2>
      </div>
      <div className={cardBody}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <SummaryCell
            label="Duration"
            value={formatTime(capturedAttempt.durationSeconds)}
          />
          <SummaryCell
            label="Words"
            value={wordCount}
          />
          <div className="sm:col-span-2">
            <SummaryCell
              label="Transcript preview"
              value={capturedAttempt.transcript}
              multiline
            />
          </div>
        </dl>

        <div className="mt-6">
          {isDiagnosticMode ? (
            <button
              type="button"
              onClick={onRunDiagnostic}
              disabled={diagnosticLoading}
              className={`${buttonPrimary} w-full sm:w-auto`}
            >
              {diagnosticLoading ? "Running diagnostic..." : "Run Diagnostic"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onGetFeedback}
              disabled={feedbackLoading}
              className={`${buttonPrimary} w-full sm:w-auto`}
            >
              {feedbackLoading ? "Generating feedback..." : "Get AI Feedback"}
            </button>
          )}
        </div>

        {feedbackError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-[var(--brand-coral)]/50 bg-[var(--brand-coral-soft)] px-4 py-3 text-sm text-[var(--brand-coral)]"
          >
            <p>{feedbackError}</p>
            <p className="mt-1 text-xs opacity-80">
              You can try again, wait a moment, or switch provider before
              starting a new session.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onGetFeedback}
                disabled={feedbackLoading}
                className={errorButtonClass}
              >
                {feedbackLoading ? "Trying again..." : "Try Again"}
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <div className="mt-6 rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Quick feedback
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4">
              <SummaryCell
                label="Main Weakness"
                value={feedback.mainWeakness}
                multiline
              />
              <SummaryCell
                label="Evidence"
                value={feedback.evidence}
                multiline
              />
              <SummaryCell
                label="Better Phrase"
                value={feedback.betterPhrase}
                multiline
              />
              <SummaryCell
                label="Retry Task"
                value={feedback.retryTask}
                multiline
              />
              <SummaryCell
                label="Provider Used"
                value={feedback.providerUsed}
              />
            </dl>

            {activeLevel && (
              <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                <p className={labelClass}>Scores</p>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                  {scoreKeysForLevel(activeLevel).map((key) => (
                    <li
                      key={key}
                      className="flex items-baseline justify-between text-sm"
                    >
                      <span className="text-[var(--brand-ink-soft)]">
                        {SCORE_LABELS[key]}
                      </span>
                      <span className="font-mono tabular-nums text-[var(--brand-ink)]">
                        {safeScore(feedback.scores?.[key])}/5
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {isDiagnosticMode && diagnosticError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-[var(--brand-coral)]/50 bg-[var(--brand-coral-soft)] px-4 py-3 text-sm text-[var(--brand-coral)]"
          >
            <p>{diagnosticError}</p>
            <p className="mt-1 text-xs opacity-80">
              You can try again, wait a moment, or switch provider.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onRunDiagnostic}
                disabled={diagnosticLoading}
                className={errorButtonClass}
              >
                {diagnosticLoading ? "Trying again..." : "Try Again"}
              </button>
            </div>
          </div>
        )}

        {isDiagnosticMode && diagnosticResult && (
          <div className="mt-6 rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Diagnostic result
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <SummaryCell
                label="Recommended Level"
                value={diagnosticResult.recommendedLevel}
              />
              <SummaryCell
                label="Main Bottleneck"
                value={diagnosticResult.mainBottleneck}
                multiline
              />
              <div className="sm:col-span-2">
                <SummaryCell
                  label="Summary"
                  value={diagnosticResult.summary}
                  multiline
                />
              </div>
            </dl>
            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <p className={labelClass}>Scores</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {(
                  [
                    "fluency",
                    "grammar",
                    "vocabulary",
                    "coherence",
                    "argument",
                    "academicTone",
                  ] as const
                ).map((key) => (
                  <li
                    key={key}
                    className="flex items-baseline justify-between text-sm"
                  >
                    <span className="text-[var(--brand-ink-soft)]">
                      {SCORE_LABELS[key]}
                    </span>
                    <span className="font-mono tabular-nums text-[var(--brand-ink)]">
                      {diagnosticResult.scores[key]}/5
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <p className={labelClass}>7-Day Focus Plan</p>
              <ol className="list-none space-y-1 text-sm text-[var(--brand-ink)]">
                {diagnosticResult.sevenDayFocusPlan.map((item, i) => (
                  <li key={i} className="break-words">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={onApplyRecommendedLevel}
                className={buttonSecondary}
              >
                Apply Recommended Level
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
