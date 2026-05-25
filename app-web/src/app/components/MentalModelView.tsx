export type MentalModelResult = {
  coreStandard: string;
  qualityCriteria: string[];
  weakPattern: string;
  strongPattern: string;
  selfCheckQuestions: string[];
  microDrill: string;
  referenceModel: string;
};

type MentalModelViewProps = {
  level: string;
  mode: string;
  focus: string;
  focusPlaceholder: string;
  mentalModelResult: MentalModelResult | null;
  mentalModelLoading: boolean;
  mentalModelError: string | null;
  onFocusChange: (value: string) => void;
  onGenerateMentalModel: () => void;
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

export function MentalModelView({
  level,
  mode,
  focus,
  focusPlaceholder,
  mentalModelResult,
  mentalModelLoading,
  mentalModelError,
  onFocusChange,
  onGenerateMentalModel,
}: MentalModelViewProps) {
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

  return (
    <section className={card}>
      <div className={cardHeader}>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
          AI teaching
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          Mental Model
        </h2>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          Use this before practice to understand quality standards and response
          patterns. It is not a memorized answer generator.
        </p>
      </div>
      <div className={`${cardBody} flex flex-col gap-5`}>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCell label="Level" value={level} />
            <SummaryCell label="Mode" value={mode} />
            <div className="sm:col-span-2">
              <label htmlFor="mental-model-focus" className={labelClass}>
                Focus / Weakness
              </label>
              <textarea
                id="mental-model-focus"
                rows={3}
                value={focus}
                onChange={(event) => onFocusChange(event.target.value)}
                placeholder={focusPlaceholder}
                className={`${inputClass} resize-y leading-6`}
              />
              <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                Leave blank to use the current target or latest practice weakness.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--brand-ink-soft)]">
              The request sends setup context and recent weakness text only, not
              transcripts.
            </p>
            <button
              type="button"
              onClick={onGenerateMentalModel}
              disabled={mentalModelLoading}
              className={`${buttonPrimary} w-full sm:w-auto`}
            >
              {mentalModelLoading
                ? "Generating mental model..."
                : "Generate Mental Model"}
            </button>
          </div>
        </div>

        {mentalModelError && (
          <div
            role="alert"
            className="rounded-lg border border-[var(--brand-coral)]/50 bg-[var(--brand-coral-soft)] px-4 py-3 text-sm text-[var(--brand-coral)]"
          >
            <p>{mentalModelError}</p>
            <p className="mt-1 text-xs opacity-80">
              You can try again, wait a moment, or switch provider.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onGenerateMentalModel}
                disabled={mentalModelLoading}
                className="rounded-lg border border-[var(--brand-coral)]/60 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-coral)] transition-colors hover:bg-[var(--brand-coral-soft)]/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mentalModelLoading ? "Trying again..." : "Try Again"}
              </button>
            </div>
          </div>
        )}

        {mentalModelResult && (
          <div className="rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Mental model result
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <SummaryCell
                label="Core Standard"
                value={mentalModelResult.coreStandard}
                multiline
              />
              <SummaryCell
                label="Micro Drill"
                value={mentalModelResult.microDrill}
                multiline
              />
              <SummaryCell
                label="Weak Pattern"
                value={mentalModelResult.weakPattern}
                multiline
              />
              <SummaryCell
                label="Strong Pattern"
                value={mentalModelResult.strongPattern}
                multiline
              />
            </dl>

            <div className="mt-5 grid grid-cols-1 gap-5 border-t border-[var(--brand-border)] pt-4 lg:grid-cols-2">
              <div>
                <p className={labelClass}>Quality Criteria</p>
                <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
                  {mentalModelResult.qualityCriteria.map((item) => (
                    <li key={item} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={labelClass}>Self-Check Questions</p>
                <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
                  {mentalModelResult.selfCheckQuestions.map((item) => (
                    <li key={item} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <p className={labelClass}>Reference Model</p>
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--brand-ink)]">
                {mentalModelResult.referenceModel}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
