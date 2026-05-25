type SessionSetupProps = {
  level: string;
  mode: string;
  feedbackType: string;
  sessionType: string;
  aiProvider: string;
  target: string;
  hasActiveSession: boolean;
  hasPreviousSession: boolean;
  levels: readonly string[];
  modes: readonly string[];
  feedbackTypes: readonly string[];
  sessionTypes: readonly string[];
  aiProviders: readonly string[];
  onLevelChange: (value: string) => void;
  onModeChange: (value: string) => void;
  onFeedbackTypeChange: (value: string) => void;
  onSessionTypeChange: (value: string) => void;
  onAiProviderChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onStartSession: () => void;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const inputClass =
    "w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-teal)]";

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function modeDescription(mode: string): string {
  if (mode === "Diagnostic") return "Baseline assessment";
  if (mode === "Fluency Sprint") return "Speak without stopping";
  if (mode === "Argument Drill") return "Defend a position";
  if (mode === "Reading-to-Speaking") return "Explain an excerpt";
  return "Make a debatable claim";
}

export function SessionSetup({
  level,
  mode,
  feedbackType,
  sessionType,
  aiProvider,
  target,
  hasActiveSession,
  hasPreviousSession,
  levels,
  modes,
  feedbackTypes,
  sessionTypes,
  aiProviders,
  onLevelChange,
  onModeChange,
  onFeedbackTypeChange,
  onSessionTypeChange,
  onAiProviderChange,
  onTargetChange,
  onStartSession,
}: SessionSetupProps) {
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
          Step 1
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          Session setup
        </h2>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          Pick your mode visibly, set the rest, then start.
        </p>
      </div>
      <div className={cardBody}>
        {/* Mode cards (replaces the old dropdown) */}
        <fieldset>
          <legend className={labelClass}>Mode</legend>
          <div
            role="radiogroup"
            aria-label="Practice mode"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            {modes.map((m) => {
              const selected = mode === m;
              const isDiagnostic = m === "Diagnostic";
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onModeChange(m)}
                  className={
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] " +
                    (selected
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/60 text-[var(--brand-teal-ink)]"
                      : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-surface)]")
                  }
                >
                  <span className="font-medium">{m}</span>
                  <span className="text-xs text-[var(--brand-ink-soft)]">
                    {modeDescription(m)}
                  </span>
                  {isDiagnostic && (
                    <span className="mt-1 inline-flex items-center rounded-full border border-[var(--brand-gold)]/50 bg-[var(--brand-gold-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--brand-ink)]">
                      Assessment
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Other controls */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            label="Level"
            value={level}
            options={levels}
            onChange={onLevelChange}
          />
          <SelectField
            label="Feedback Type"
            value={feedbackType}
            options={feedbackTypes}
            onChange={onFeedbackTypeChange}
          />
          <SelectField
            label="Session Type"
            value={sessionType}
            options={sessionTypes}
            onChange={onSessionTypeChange}
          />
          <SelectField
            label="AI Provider"
            value={aiProvider}
            options={aiProviders}
            onChange={onAiProviderChange}
          />

          <div className="sm:col-span-2">
            <label htmlFor="target" className={labelClass}>
              Today&apos;s Target
            </label>
            <textarea
              id="target"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              rows={3}
              placeholder="What do you want to improve in this session?"
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>

        <div className="mt-6">
          {!hasPreviousSession && (
            <p className="mb-3 text-xs text-[var(--brand-ink-soft)]">
              No previous weakness yet. Complete one session to activate
              weakness repetition.
            </p>
          )}
          <button
            type="button"
            onClick={onStartSession}
            className={`${buttonPrimary} w-full sm:w-auto`}
          >
            {hasActiveSession ? "Restart Session" : "Start Session"}
          </button>
        </div>
      </div>
    </section>
  );
}
