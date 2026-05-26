import type {
  VocabItem,
  VocabLevel,
  VocabSentenceCorrection,
  VocabSource,
  VocabStats,
  VocabStatus,
} from "../lib/vocabulary";

type VocabularyMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

type VocabularyNotebookViewProps = {
  items: VocabItem[];
  stats: VocabStats;
  formWord: string;
  formMeaning: string;
  formLevel: VocabLevel;
  formSource: VocabSource;
  formExample: string;
  formCollocations: string;
  selectedItemId: string | null;
  sentenceDraft: string;
  message: VocabularyMessage | null;
  correctionLoadingId: string | null;
  correctionError: { sentenceId: string; text: string } | null;
  onFormWordChange: (value: string) => void;
  onFormMeaningChange: (value: string) => void;
  onFormLevelChange: (value: VocabLevel) => void;
  onFormSourceChange: (value: VocabSource) => void;
  onFormExampleChange: (value: string) => void;
  onFormCollocationsChange: (value: string) => void;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  onStatusChange: (id: string, status: VocabStatus) => void;
  onSelectPracticeItem: (id: string) => void;
  onSentenceDraftChange: (value: string) => void;
  onSubmitSentence: () => void;
  onCheckSentence: (itemId: string, sentenceId: string) => void;
};

const VOCAB_LEVELS: readonly VocabLevel[] = [
  "Foundation",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

const VOCAB_SOURCES: readonly VocabSource[] = [
  "manual",
  "article",
  "feedback",
  "mental-model",
];

const VOCAB_STATUSES: readonly VocabStatus[] = [
  "new",
  "practicing",
  "active",
  "mastered",
  "paused",
];

function statusLabel(status: VocabStatus): string {
  if (status === "new") return "New";
  if (status === "practicing") return "Practicing";
  if (status === "active") return "Active";
  if (status === "mastered") return "Mastered";
  return "Paused";
}

function sourceLabel(source: VocabSource): string {
  if (source === "manual") return "Manual";
  if (source === "article") return "Article";
  if (source === "feedback") return "Feedback";
  return "Mental Model";
}

function correctionStatusLabel(status: VocabSentenceCorrection["status"]): string {
  if (status === "natural") return "Natural";
  if (status === "understandable") return "Understandable";
  if (status === "awkward") return "Awkward";
  return "Incorrect";
}

function correctionStatusClass(status: VocabSentenceCorrection["status"]): string {
  if (status === "natural" || status === "understandable") {
    return "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)]";
  }
  if (status === "awkward") {
    return "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-ink)]";
  }
  return "bg-[var(--brand-coral-soft)] text-[var(--brand-ink)]";
}

export function VocabularyNotebookView({
  items,
  stats,
  formWord,
  formMeaning,
  formLevel,
  formSource,
  formExample,
  formCollocations,
  selectedItemId,
  sentenceDraft,
  message,
  correctionLoadingId,
  correctionError,
  onFormWordChange,
  onFormMeaningChange,
  onFormLevelChange,
  onFormSourceChange,
  onFormExampleChange,
  onFormCollocationsChange,
  onAddItem,
  onDeleteItem,
  onStatusChange,
  onSelectPracticeItem,
  onSentenceDraftChange,
  onSubmitSentence,
  onCheckSentence,
}: VocabularyNotebookViewProps) {
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
  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;

  return (
    <section className={card}>
      <div className={cardHeader}>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
          Local notebook
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          Vocabulary Notebook
        </h2>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          Save useful words, then practice using them in your own sentences.
          No AI sentence is generated here.
        </p>
      </div>

      <div className={`${cardBody} space-y-6`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <StatCard label="Total words" value={String(stats.totalCount)} />
          <StatCard label="New" value={String(stats.byStatus.new)} />
          <StatCard
            label="Practicing"
            value={String(stats.byStatus.practicing)}
          />
          <StatCard label="Active" value={String(stats.byStatus.active)} />
          <StatCard label="Reuse" value={String(stats.totalReuseCount)} />
        </div>

        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
              Add vocabulary
            </h3>
            <p className="text-xs text-[var(--brand-ink-soft)]">
              Keep it simple: one useful word or phrase, one clear meaning.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vocab-word" className={labelClass}>
                Word or phrase
              </label>
              <input
                id="vocab-word"
                value={formWord}
                onChange={(event) => onFormWordChange(event.target.value)}
                placeholder="e.g. clarify"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="vocab-meaning" className={labelClass}>
                Meaning
              </label>
              <input
                id="vocab-meaning"
                value={formMeaning}
                onChange={(event) => onFormMeaningChange(event.target.value)}
                placeholder="short meaning in your own words"
                className={inputClass}
              />
            </div>
            <SelectField
              id="vocab-level"
              label="Level"
              value={formLevel}
              options={VOCAB_LEVELS}
              getLabel={(value) => value}
              onChange={(value) => onFormLevelChange(value as VocabLevel)}
            />
            <SelectField
              id="vocab-source"
              label="Source"
              value={formSource}
              options={VOCAB_SOURCES}
              getLabel={sourceLabel}
              onChange={(value) => onFormSourceChange(value as VocabSource)}
            />
            <div>
              <label htmlFor="vocab-example" className={labelClass}>
                Example (optional)
              </label>
              <input
                id="vocab-example"
                value={formExample}
                onChange={(event) => onFormExampleChange(event.target.value)}
                placeholder="short note or source sentence"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="vocab-collocations" className={labelClass}>
                Collocations (optional)
              </label>
              <input
                id="vocab-collocations"
                value={formCollocations}
                onChange={(event) =>
                  onFormCollocationsChange(event.target.value)
                }
                placeholder="comma-separated phrases"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-4">
            <button type="button" onClick={onAddItem} className={buttonPrimary}>
              Add Vocabulary
            </button>
          </div>
        </div>

        {message && (
          <p
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.tone === "success"
                ? "border-[var(--brand-teal)]/30 bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)]"
                : message.tone === "error"
                  ? "border-[var(--brand-coral)]/30 bg-[var(--brand-coral-soft)] text-[var(--brand-ink)]"
                  : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink-soft)]"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
              Saved vocabulary
            </h3>
            {items.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 text-sm text-[var(--brand-ink-soft)]">
                No saved vocabulary yet. Add one word you want to use in
                speaking practice.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-[var(--brand-ink)]">
                            {item.word}
                          </p>
                          <span className="rounded-full bg-[var(--brand-teal-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-teal-ink)]">
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
                          {item.meaning}
                        </p>
                        <p className="mt-2 text-xs text-[var(--brand-muted)]">
                          {item.level} - {sourceLabel(item.source)} -{" "}
                          {item.reuseCount} reuse
                        </p>
                        {item.example && (
                          <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                            Example: {item.example}
                          </p>
                        )}
                        {item.collocations.length > 0 && (
                          <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                            Collocations: {item.collocations.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        <select
                          value={item.status}
                          onChange={(event) =>
                            onStatusChange(
                              item.id,
                              event.target.value as VocabStatus,
                            )
                          }
                          className={inputClass}
                          aria-label={`Status for ${item.word}`}
                        >
                          {VOCAB_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onSelectPracticeItem(item.id)}
                          className={buttonSecondary}
                        >
                          Practice
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          className="rounded-lg border border-[var(--brand-coral)]/40 bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-coral-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-coral)]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
              Sentence practice
            </h3>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              Write one simple sentence using this word. Use the word yourself.
              No AI sentence is generated here.
            </p>

            {selectedItem ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
                  Practice word
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  {selectedItem.word}
                </p>
                <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
                  {selectedItem.meaning}
                </p>

                <label htmlFor="vocab-sentence" className={`${labelClass} mt-5`}>
                  Your sentence
                </label>
                <textarea
                  id="vocab-sentence"
                  value={sentenceDraft}
                  onChange={(event) =>
                    onSentenceDraftChange(event.target.value)
                  }
                  rows={5}
                  placeholder={`Write one sentence using "${selectedItem.word}"...`}
                  className={`${inputClass} resize-y leading-6`}
                />
                <button
                  type="button"
                  onClick={onSubmitSentence}
                  className={`${buttonPrimary} mt-4 w-full`}
                >
                  Save Sentence
                </button>

                {selectedItem.userSentences.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
                      Saved sentences
                    </p>
                    <ul className="mt-2 space-y-2">
                      {selectedItem.userSentences
                        .slice()
                        .reverse()
                        .map((sentence) => (
                          <li
                            key={sentence.id}
                            className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-3 text-sm text-[var(--brand-ink)]"
                          >
                            <p>{sentence.sentence}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onCheckSentence(selectedItem.id, sentence.id)
                                }
                                disabled={correctionLoadingId !== null}
                                className={buttonSecondary}
                              >
                                {correctionLoadingId === sentence.id
                                  ? "Checking..."
                                  : "Check Usage"}
                              </button>
                              {sentence.correction && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${correctionStatusClass(
                                    sentence.correction.status,
                                  )}`}
                                >
                                  {correctionStatusLabel(
                                    sentence.correction.status,
                                  )}
                                </span>
                              )}
                            </div>

                            {correctionError?.sentenceId === sentence.id && (
                              <p className="mt-3 rounded-lg border border-[var(--brand-coral)]/30 bg-[var(--brand-coral-soft)] px-3 py-2 text-xs text-[var(--brand-ink)]">
                                {correctionError.text}
                              </p>
                            )}

                            {sentence.correction && (
                              <div className="mt-3 space-y-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-3 text-xs text-[var(--brand-ink-soft)]">
                                <p>
                                  <span className="font-semibold text-[var(--brand-ink)]">
                                    Explanation:
                                  </span>{" "}
                                  {sentence.correction.explanation}
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--brand-ink)]">
                                    Corrected sentence:
                                  </span>{" "}
                                  {sentence.correction.correctedSentence}
                                </p>
                                <p className="text-[var(--brand-muted)]">
                                  Use this to improve your next attempt. Do not
                                  replace your original sentence automatically.
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--brand-ink)]">
                                    Collocation tip:
                                  </span>{" "}
                                  {sentence.correction.collocationTip}
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--brand-ink)]">
                                    Retry:
                                  </span>{" "}
                                  {sentence.correction.retryInstruction}
                                </p>
                                {sentence.correction.warnings.length > 0 && (
                                  <div>
                                    <p className="font-semibold text-[var(--brand-ink)]">
                                      Warnings
                                    </p>
                                    <ul className="mt-1 list-disc space-y-1 pl-4">
                                      {sentence.correction.warnings.map(
                                        (warning) => (
                                          <li key={warning}>{warning}</li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 text-sm text-[var(--brand-ink-soft)]">
                Add vocabulary first, then practice one sentence at a time.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--brand-ink)]">
        {value}
      </p>
    </div>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  getLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  getLabel: (value: T) => string;
  onChange: (value: T) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-sm text-[var(--brand-ink)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-teal)]";
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
