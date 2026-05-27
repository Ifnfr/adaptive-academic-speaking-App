import type {
  VocabItem,
  VocabLevel,
  VocabPartOfSpeech,
  VocabSentenceCorrection,
  VocabSource,
  VocabStats,
  VocabStatus,
} from "../lib/vocabulary";

type VocabularyMode = "recent" | "manage" | "practice";
type PracticeCardState = "writing" | "accepted" | "skipped";

type VocabularyMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

type VocabularyNotebookViewProps = {
  mode: VocabularyMode;
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
  practiceCurrentItem: VocabItem | null;
  practiceQueueLength: number;
  practiceIndex: number;
  practiceCardState: PracticeCardState;
  practiceHintVisible: boolean;
  practicePracticedCount: number;
  practiceSkippedCount: number;
  practiceComplete: boolean;
  practiceAcceptedSentenceId: string | null;
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
  onBackToHome: () => void;
  onViewAll: () => void;
  onStartPractice: () => void;
  onShowPracticeHint: () => void;
  onSubmitPracticeSentence: () => void;
  onSkipPracticeCard: () => void;
  onNextPracticeCard: () => void;
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

function partOfSpeechLabel(partOfSpeech: VocabPartOfSpeech | undefined): string {
  if (!partOfSpeech || partOfSpeech === "other") return "Other";
  if (partOfSpeech === "adj") return "Adjective";
  if (partOfSpeech === "adv") return "Adverb";
  if (partOfSpeech === "prep") return "Preposition";
  return partOfSpeech
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function formatDate(value: string | null): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sortByCreatedAtDesc(items: VocabItem[]): VocabItem[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.createdAt);
    const bTime = Date.parse(b.createdAt);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return a.word.localeCompare(b.word);
  });
}

export function VocabularyNotebookView({
  mode,
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
  practiceCurrentItem,
  practiceQueueLength,
  practiceIndex,
  practiceCardState,
  practiceHintVisible,
  practicePracticedCount,
  practiceSkippedCount,
  practiceComplete,
  practiceAcceptedSentenceId,
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
  onBackToHome,
  onViewAll,
  onStartPractice,
  onShowPracticeHint,
  onSubmitPracticeSentence,
  onSkipPracticeCard,
  onNextPracticeCard,
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
  const recentItems = sortByCreatedAtDesc(items).slice(0, 5);

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
          Move saved words from passive storage into active speaking recall.
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

        {mode === "recent" && (
          <RecentVocabularyHome
            items={items}
            recentItems={recentItems}
            formWord={formWord}
            formMeaning={formMeaning}
            formLevel={formLevel}
            formSource={formSource}
            formExample={formExample}
            formCollocations={formCollocations}
            labelClass={labelClass}
            inputClass={inputClass}
            buttonPrimary={buttonPrimary}
            buttonSecondary={buttonSecondary}
            onFormWordChange={onFormWordChange}
            onFormMeaningChange={onFormMeaningChange}
            onFormLevelChange={onFormLevelChange}
            onFormSourceChange={onFormSourceChange}
            onFormExampleChange={onFormExampleChange}
            onFormCollocationsChange={onFormCollocationsChange}
            onAddItem={onAddItem}
            onStartPractice={onStartPractice}
            onViewAll={onViewAll}
          />
        )}

        {mode === "manage" && (
          <ManageVocabularyView
            items={items}
            selectedItem={selectedItem}
            sentenceDraft={sentenceDraft}
            correctionLoadingId={correctionLoadingId}
            correctionError={correctionError}
            labelClass={labelClass}
            inputClass={inputClass}
            buttonPrimary={buttonPrimary}
            buttonSecondary={buttonSecondary}
            onBackToHome={onBackToHome}
            onDeleteItem={onDeleteItem}
            onStatusChange={onStatusChange}
            onSelectPracticeItem={onSelectPracticeItem}
            onSentenceDraftChange={onSentenceDraftChange}
            onSubmitSentence={onSubmitSentence}
            onCheckSentence={onCheckSentence}
          />
        )}

        {mode === "practice" && (
          <RecallPracticeView
            currentItem={practiceCurrentItem}
            queueLength={practiceQueueLength}
            index={practiceIndex}
            cardState={practiceCardState}
            hintVisible={practiceHintVisible}
            practicedCount={practicePracticedCount}
            skippedCount={practiceSkippedCount}
            complete={practiceComplete}
            acceptedSentenceId={practiceAcceptedSentenceId}
            sentenceDraft={sentenceDraft}
            correctionLoadingId={correctionLoadingId}
            correctionError={correctionError}
            labelClass={labelClass}
            inputClass={inputClass}
            buttonPrimary={buttonPrimary}
            buttonSecondary={buttonSecondary}
            onSentenceDraftChange={onSentenceDraftChange}
            onSubmitSentence={onSubmitPracticeSentence}
            onShowHint={onShowPracticeHint}
            onSkip={onSkipPracticeCard}
            onNext={onNextPracticeCard}
            onBackToHome={onBackToHome}
            onStartPractice={onStartPractice}
            onCheckSentence={onCheckSentence}
          />
        )}
      </div>
    </section>
  );
}

function RecentVocabularyHome({
  items,
  recentItems,
  formWord,
  formMeaning,
  formLevel,
  formSource,
  formExample,
  formCollocations,
  labelClass,
  inputClass,
  buttonPrimary,
  buttonSecondary,
  onFormWordChange,
  onFormMeaningChange,
  onFormLevelChange,
  onFormSourceChange,
  onFormExampleChange,
  onFormCollocationsChange,
  onAddItem,
  onStartPractice,
  onViewAll,
}: {
  items: VocabItem[];
  recentItems: VocabItem[];
  formWord: string;
  formMeaning: string;
  formLevel: VocabLevel;
  formSource: VocabSource;
  formExample: string;
  formCollocations: string;
  labelClass: string;
  inputClass: string;
  buttonPrimary: string;
  buttonSecondary: string;
  onFormWordChange: (value: string) => void;
  onFormMeaningChange: (value: string) => void;
  onFormLevelChange: (value: VocabLevel) => void;
  onFormSourceChange: (value: VocabSource) => void;
  onFormExampleChange: (value: string) => void;
  onFormCollocationsChange: (value: string) => void;
  onAddItem: () => void;
  onStartPractice: () => void;
  onViewAll: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)]">
      <AddVocabularyForm
        formWord={formWord}
        formMeaning={formMeaning}
        formLevel={formLevel}
        formSource={formSource}
        formExample={formExample}
        formCollocations={formCollocations}
        labelClass={labelClass}
        inputClass={inputClass}
        buttonPrimary={buttonPrimary}
        onFormWordChange={onFormWordChange}
        onFormMeaningChange={onFormMeaningChange}
        onFormLevelChange={onFormLevelChange}
        onFormSourceChange={onFormSourceChange}
        onFormExampleChange={onFormExampleChange}
        onFormCollocationsChange={onFormCollocationsChange}
        onAddItem={onAddItem}
      />

      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
              Recent vocabulary
            </h3>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
              The newest five words stay here. Use View All for full dictionary
              details and history.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onStartPractice}
              disabled={items.length === 0}
              className={buttonPrimary}
            >
              Start Practice
            </button>
            <button
              type="button"
              onClick={onViewAll}
              className={buttonSecondary}
            >
              View All / Manage Vocabulary
            </button>
          </div>
        </div>

        {recentItems.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 text-sm text-[var(--brand-ink-soft)]">
            No saved vocabulary yet. Add one useful word or phrase to begin.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3">
            {recentItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-[var(--brand-ink)]">
                    {item.word}
                  </p>
                  <Pill>{statusLabel(item.status)}</Pill>
                  <Pill>{partOfSpeechLabel(item.partOfSpeech)}</Pill>
                </div>
                <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
                  {item.meaning}
                </p>
                <p className="mt-2 text-xs text-[var(--brand-muted)]">
                  {item.level} - {sourceLabel(item.source)} - {item.reuseCount} reuse
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddVocabularyForm({
  formWord,
  formMeaning,
  formLevel,
  formSource,
  formExample,
  formCollocations,
  labelClass,
  inputClass,
  buttonPrimary,
  onFormWordChange,
  onFormMeaningChange,
  onFormLevelChange,
  onFormSourceChange,
  onFormExampleChange,
  onFormCollocationsChange,
  onAddItem,
}: {
  formWord: string;
  formMeaning: string;
  formLevel: VocabLevel;
  formSource: VocabSource;
  formExample: string;
  formCollocations: string;
  labelClass: string;
  inputClass: string;
  buttonPrimary: string;
  onFormWordChange: (value: string) => void;
  onFormMeaningChange: (value: string) => void;
  onFormLevelChange: (value: VocabLevel) => void;
  onFormSourceChange: (value: VocabSource) => void;
  onFormExampleChange: (value: string) => void;
  onFormCollocationsChange: (value: string) => void;
  onAddItem: () => void;
}) {
  return (
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
            onChange={(event) => onFormCollocationsChange(event.target.value)}
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
  );
}

function ManageVocabularyView({
  items,
  selectedItem,
  sentenceDraft,
  correctionLoadingId,
  correctionError,
  labelClass,
  inputClass,
  buttonPrimary,
  buttonSecondary,
  onBackToHome,
  onDeleteItem,
  onStatusChange,
  onSelectPracticeItem,
  onSentenceDraftChange,
  onSubmitSentence,
  onCheckSentence,
}: {
  items: VocabItem[];
  selectedItem: VocabItem | null;
  sentenceDraft: string;
  correctionLoadingId: string | null;
  correctionError: { sentenceId: string; text: string } | null;
  labelClass: string;
  inputClass: string;
  buttonPrimary: string;
  buttonSecondary: string;
  onBackToHome: () => void;
  onDeleteItem: (id: string) => void;
  onStatusChange: (id: string, status: VocabStatus) => void;
  onSelectPracticeItem: (id: string) => void;
  onSentenceDraftChange: (value: string) => void;
  onSubmitSentence: () => void;
  onCheckSentence: (itemId: string, sentenceId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
            View all vocabulary
          </h3>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            Manage saved words, statuses, usage history, and correction feedback.
          </p>
        </div>
        <button type="button" onClick={onBackToHome} className={buttonSecondary}>
          Back to Vocabulary Notebook
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div>
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 text-sm text-[var(--brand-ink-soft)]">
              No saved vocabulary yet. Go back and add one word you want to use
              in speaking practice.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <VocabularyManageCard
                  key={item.id}
                  item={item}
                  inputClass={inputClass}
                  buttonSecondary={buttonSecondary}
                  onStatusChange={onStatusChange}
                  onSelectPracticeItem={onSelectPracticeItem}
                  onDeleteItem={onDeleteItem}
                />
              ))}
            </ul>
          )}
        </div>

        <SentencePracticePanel
          selectedItem={selectedItem}
          sentenceDraft={sentenceDraft}
          correctionLoadingId={correctionLoadingId}
          correctionError={correctionError}
          labelClass={labelClass}
          inputClass={inputClass}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
          onSentenceDraftChange={onSentenceDraftChange}
          onSubmitSentence={onSubmitSentence}
          onCheckSentence={onCheckSentence}
        />
      </div>
    </div>
  );
}

function VocabularyManageCard({
  item,
  inputClass,
  buttonSecondary,
  onStatusChange,
  onSelectPracticeItem,
  onDeleteItem,
}: {
  item: VocabItem;
  inputClass: string;
  buttonSecondary: string;
  onStatusChange: (id: string, status: VocabStatus) => void;
  onSelectPracticeItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
}) {
  return (
    <li className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-[var(--brand-ink)]">
              {item.word}
            </p>
            <Pill>{statusLabel(item.status)}</Pill>
            <Pill>{partOfSpeechLabel(item.partOfSpeech)}</Pill>
          </div>
          <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
            {item.meaning}
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-[var(--brand-muted)] sm:grid-cols-2">
            <Metadata label="Level" value={item.level} />
            <Metadata label="Source" value={sourceLabel(item.source)} />
            <Metadata label="Reuse" value={String(item.reuseCount)} />
            <Metadata label="Correct Use" value={String(item.correctUseCount)} />
            <Metadata label="Saved" value={formatDate(item.createdAt)} />
            <Metadata label="Last Practiced" value={formatDate(item.lastPracticedAt)} />
          </dl>
          {item.example && (
            <p className="mt-3 text-xs text-[var(--brand-ink-soft)]">
              Example: {item.example}
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
            Usage note:{" "}
            {item.collocations.length > 0
              ? item.collocations.join(", ")
              : "No collocations saved yet."}
          </p>
          <p className="mt-2 text-xs text-[var(--brand-muted)]">
            Sentence history: {item.userSentences.length}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <select
            value={item.status}
            onChange={(event) =>
              onStatusChange(item.id, event.target.value as VocabStatus)
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
  );
}

function SentencePracticePanel({
  selectedItem,
  sentenceDraft,
  correctionLoadingId,
  correctionError,
  labelClass,
  inputClass,
  buttonPrimary,
  buttonSecondary,
  onSentenceDraftChange,
  onSubmitSentence,
  onCheckSentence,
}: {
  selectedItem: VocabItem | null;
  sentenceDraft: string;
  correctionLoadingId: string | null;
  correctionError: { sentenceId: string; text: string } | null;
  labelClass: string;
  inputClass: string;
  buttonPrimary: string;
  buttonSecondary: string;
  onSentenceDraftChange: (value: string) => void;
  onSubmitSentence: () => void;
  onCheckSentence: (itemId: string, sentenceId: string) => void;
}) {
  return (
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
            onChange={(event) => onSentenceDraftChange(event.target.value)}
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

          <SavedSentences
            item={selectedItem}
            correctionLoadingId={correctionLoadingId}
            correctionError={correctionError}
            buttonSecondary={buttonSecondary}
            onCheckSentence={onCheckSentence}
          />
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 text-sm text-[var(--brand-ink-soft)]">
          Add vocabulary first, then practice one sentence at a time.
        </p>
      )}
    </div>
  );
}

function RecallPracticeView({
  currentItem,
  queueLength,
  index,
  cardState,
  hintVisible,
  practicedCount,
  skippedCount,
  complete,
  acceptedSentenceId,
  sentenceDraft,
  correctionLoadingId,
  correctionError,
  labelClass,
  inputClass,
  buttonPrimary,
  buttonSecondary,
  onSentenceDraftChange,
  onSubmitSentence,
  onShowHint,
  onSkip,
  onNext,
  onBackToHome,
  onStartPractice,
  onCheckSentence,
}: {
  currentItem: VocabItem | null;
  queueLength: number;
  index: number;
  cardState: PracticeCardState;
  hintVisible: boolean;
  practicedCount: number;
  skippedCount: number;
  complete: boolean;
  acceptedSentenceId: string | null;
  sentenceDraft: string;
  correctionLoadingId: string | null;
  correctionError: { sentenceId: string; text: string } | null;
  labelClass: string;
  inputClass: string;
  buttonPrimary: string;
  buttonSecondary: string;
  onSentenceDraftChange: (value: string) => void;
  onSubmitSentence: () => void;
  onShowHint: () => void;
  onSkip: () => void;
  onNext: () => void;
  onBackToHome: () => void;
  onStartPractice: () => void;
  onCheckSentence: (itemId: string, sentenceId: string) => void;
}) {
  if (complete) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
          Active recall complete
        </p>
        <h3 className="mt-2 text-xl font-semibold text-[var(--brand-ink)]">
          Session complete
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Practiced" value={String(practicedCount)} />
          <StatCard label="Skipped" value={String(skippedCount)} />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onBackToHome} className={buttonSecondary}>
            Back to Vocabulary Notebook
          </button>
          <button type="button" onClick={onStartPractice} className={buttonPrimary}>
            Start Another Session
          </button>
        </div>
      </div>
    );
  }

  if (!currentItem || queueLength === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
        <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
          No practice queue available
        </h3>
        <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
          Add vocabulary or unpause saved items before starting active recall.
        </p>
        <button
          type="button"
          onClick={onBackToHome}
          className={`${buttonSecondary} mt-4`}
        >
          Back to Vocabulary Notebook
        </button>
      </div>
    );
  }

  const acceptedSentence =
    acceptedSentenceId === null
      ? null
      : currentItem.userSentences.find(
          (sentence) => sentence.id === acceptedSentenceId,
        ) ?? null;

  return (
    <div className="rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            Card {index + 1} of {queueLength}
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
            {currentItem.word}
          </h3>
          <p className="mt-1 text-xs text-[var(--brand-muted)]">
            Write one original sentence using this vocabulary.
          </p>
        </div>
        <Pill>{partOfSpeechLabel(currentItem.partOfSpeech)}</Pill>
      </div>

      {hintVisible ? (
        <div className="mt-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
          <p className={labelClass}>Hint</p>
          <p className="text-sm text-[var(--brand-ink)]">
            Meaning: {currentItem.meaning}
          </p>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
            Part of speech: {partOfSpeechLabel(currentItem.partOfSpeech)}
          </p>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
            Example: {currentItem.example || "No example saved yet."}
          </p>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
            Usage note:{" "}
            {currentItem.collocations.length > 0
              ? currentItem.collocations.join(", ")
              : "No usage note saved yet."}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onShowHint}
          className={`${buttonSecondary} mt-5`}
        >
          Show Hint
        </button>
      )}

      {cardState === "writing" && (
        <div className="mt-5">
          <label htmlFor="vocab-sentence" className={labelClass}>
            Your sentence
          </label>
          <textarea
            id="vocab-sentence"
            value={sentenceDraft}
            onChange={(event) => onSentenceDraftChange(event.target.value)}
            rows={5}
            placeholder={`Write one sentence using "${currentItem.word}"...`}
            className={`${inputClass} resize-y leading-6`}
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onSubmitSentence} className={buttonPrimary}>
              Submit Sentence
            </button>
            <button type="button" onClick={onSkip} className={buttonSecondary}>
              Skip / I don&apos;t remember
            </button>
          </div>
        </div>
      )}

      {cardState === "accepted" && acceptedSentence && (
        <div className="mt-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--brand-teal-ink)]">
            Sentence accepted
          </p>
          <p className="mt-2 text-sm text-[var(--brand-ink)]">
            {acceptedSentence.sentence}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCheckSentence(currentItem.id, acceptedSentence.id)}
              disabled={correctionLoadingId !== null}
              className={buttonSecondary}
            >
              {correctionLoadingId === acceptedSentence.id
                ? "Checking..."
                : "Check Usage"}
            </button>
            <button type="button" onClick={onNext} className={buttonPrimary}>
              {index + 1 >= queueLength ? "Finish Session" : "Next Card"}
            </button>
          </div>
          <SavedSentenceCorrection
            sentence={acceptedSentence}
            correctionError={correctionError}
          />
        </div>
      )}

      {cardState === "skipped" && (
        <div className="mt-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--brand-ink)]">
            Card skipped
          </p>
          <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
            Skip updates practice recency only. It does not add XP, reuse count,
            or correct use count.
          </p>
          <button type="button" onClick={onNext} className={`${buttonPrimary} mt-4`}>
            {index + 1 >= queueLength ? "Finish Session" : "Next Card"}
          </button>
        </div>
      )}
    </div>
  );
}

function SavedSentences({
  item,
  correctionLoadingId,
  correctionError,
  buttonSecondary,
  onCheckSentence,
}: {
  item: VocabItem;
  correctionLoadingId: string | null;
  correctionError: { sentenceId: string; text: string } | null;
  buttonSecondary: string;
  onCheckSentence: (itemId: string, sentenceId: string) => void;
}) {
  if (item.userSentences.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        Sentence history
      </p>
      <ul className="mt-2 space-y-2">
        {item.userSentences
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
                  onClick={() => onCheckSentence(item.id, sentence.id)}
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
                    {correctionStatusLabel(sentence.correction.status)}
                  </span>
                )}
              </div>
              <SavedSentenceCorrection
                sentence={sentence}
                correctionError={correctionError}
              />
            </li>
          ))}
      </ul>
    </div>
  );
}

function SavedSentenceCorrection({
  sentence,
  correctionError,
}: {
  sentence: VocabItem["userSentences"][number];
  correctionError: { sentenceId: string; text: string } | null;
}) {
  return (
    <>
      {correctionError?.sentenceId === sentence.id && (
        <p className="mt-3 rounded-lg border border-[var(--brand-coral)]/30 bg-[var(--brand-coral-soft)] px-3 py-2 text-xs text-[var(--brand-ink)]">
          {correctionError.text}
        </p>
      )}

      {sentence.correction && (
        <div className="mt-3 space-y-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-3 text-xs text-[var(--brand-ink-soft)]">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${correctionStatusClass(
              sentence.correction.status,
            )}`}
          >
            {correctionStatusLabel(sentence.correction.status)}
          </span>
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
            Use this to improve your next attempt. Do not replace your original
            sentence automatically.
          </p>
          <p>
            <span className="font-semibold text-[var(--brand-ink)]">
              Collocation tip:
            </span>{" "}
            {sentence.correction.collocationTip}
          </p>
          {sentence.correction.targetUsageRole && (
            <p>
              <span className="font-semibold text-[var(--brand-ink)]">
                Target role in your sentence:
              </span>{" "}
              {sentence.correction.targetUsageRole}
            </p>
          )}
          <p>
            <span className="font-semibold text-[var(--brand-ink)]">
              Retry:
            </span>{" "}
            {sentence.correction.retryInstruction}
          </p>
          {sentence.correction.warnings.length > 0 && (
            <div>
              <p className="font-semibold text-[var(--brand-ink)]">Warnings</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {sentence.correction.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
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

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-[var(--brand-ink-soft)]">{value}</dd>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-[var(--brand-teal-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-teal-ink)]">
      {children}
    </span>
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
