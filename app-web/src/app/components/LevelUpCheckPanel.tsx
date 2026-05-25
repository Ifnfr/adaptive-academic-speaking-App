import type {
  LevelUpCheckResult,
  LevelUpStatus,
} from "../lib/level-up";

type LevelUpCheckPanelProps = {
  result: LevelUpCheckResult;
  onApplyNextLevel: () => void;
};

function levelUpStatusClasses(status: LevelUpStatus): string {
  switch (status) {
    case "Ready":
      return "border-[var(--brand-teal)]/40 bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)]";
    case "Almost ready":
      return "border-[var(--brand-gold)]/50 bg-[var(--brand-gold-soft)] text-[var(--brand-ink)]";
    case "Not ready yet":
      return "border-[var(--brand-coral)]/40 bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]";
    case "Max level reached":
      return "border-[var(--brand-teal)]/30 bg-[var(--brand-surface-2)] text-[var(--brand-teal-ink)]";
  }
}

function SummaryCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </dt>
      <dd
        className={
          "text-sm text-[var(--brand-ink)]" +
          (mono ? " font-mono tabular-nums" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function LevelUpCheckPanel({
  result,
  onApplyNextLevel,
}: LevelUpCheckPanelProps) {
  const canApply = result.status === "Ready" && result.nextLevel !== null;
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const buttonPrimary =
    "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-teal)]">
            Level-Up Check
          </p>
          <h3 className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
            Local readiness check
          </h3>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            Based only on completed sessions stored in this browser.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium ${levelUpStatusClasses(
            result.status,
          )}`}
        >
          {result.status}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCell label="Current Level" value={result.currentLevel} />
        <SummaryCell label="Next Level" value={result.nextLevel ?? "None"} />
        <SummaryCell
          label="Valid Sessions"
          value={
            result.requiredSessionCount === 0
              ? "Not required"
              : `${result.validSessionCount}/${result.requiredSessionCount}`
          }
          mono
        />
      </dl>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div>
          <p className={labelClass}>Evidence</p>
          <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
            {result.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className={labelClass}>Missing requirements</p>
          {result.missingRequirements.length === 0 ? (
            <p className="text-sm text-[var(--brand-teal-ink)]">
              No missing requirements.
            </p>
          ) : (
            <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
              {result.missingRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className={labelClass}>Recommended next action</p>
          <p className="text-sm text-[var(--brand-ink)]">
            {result.recommendedNextAction}
          </p>
          {canApply && (
            <button
              type="button"
              onClick={onApplyNextLevel}
              className={`${buttonPrimary} mt-4 w-full sm:w-auto`}
            >
              Apply Next Level
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
