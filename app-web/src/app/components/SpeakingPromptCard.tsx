type SpeakingPromptForCard = {
  task: string;
  constraints: string[];
  targetStructure: string;
  timeLimit: string;
};

type SpeakingPromptCardProps = {
  speakingPrompt: SpeakingPromptForCard;
  onRegeneratePrompt: () => void;
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

export function SpeakingPromptCard({
  speakingPrompt,
  onRegeneratePrompt,
}: SpeakingPromptCardProps) {
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
  const cardHeader =
    "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section
      className={`${card} border-l-4 border-l-[var(--brand-teal)]`}
    >
      <div className={cardHeader}>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
          Step 2
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          Speaking prompt
        </h2>
      </div>
      <div className={cardBody}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4">
          <SummaryCell
            label="Task"
            value={speakingPrompt.task}
            multiline
          />
          <div className="flex flex-col gap-1">
            <dt className={labelClass}>Constraints</dt>
            <dd>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--brand-ink)]">
                {speakingPrompt.constraints.map((c, i) => (
                  <li key={i} className="break-words">
                    {c}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <SummaryCell
            label="Target Structure"
            value={speakingPrompt.targetStructure}
            multiline
          />
          <SummaryCell
            label="Time Limit"
            value={speakingPrompt.timeLimit}
          />
        </dl>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--brand-ink-soft)]">
            Generated locally from your level, mode, session type, and
            today&apos;s focus. The AI will not answer the prompt for you.
          </p>
          <button
            type="button"
            onClick={onRegeneratePrompt}
            className={buttonSecondary}
          >
            Regenerate Local Prompt
          </button>
        </div>
      </div>
    </section>
  );
}
