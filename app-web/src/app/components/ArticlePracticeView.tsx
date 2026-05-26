export type ArticlePracticeResult = {
  sourceTitle: string;
  sourceUrl: string;
  sourceDomain: string;
  articleBrief: string;
  mainIdea: string;
  keyPoints: string[];
  usefulVocabulary: Array<{
    word: string;
    meaning: string;
    whyUseful: string;
  }>;
  comprehensionChecks: string[];
  speakingTask: {
    title: string;
    instruction: string;
    timeLimitSeconds: number;
    targetStructure: string[];
  };
  followUpQuestions: string[];
  warnings: string[];
};

type ArticlePracticeViewProps = {
  articleUrl: string;
  articleFocus: string;
  focusPlaceholder: string;
  provider: string;
  level: string;
  mode: string;
  articlePracticeResult: ArticlePracticeResult | null;
  articlePracticeLoading: boolean;
  articlePracticeError: string | null;
  onArticleUrlChange: (value: string) => void;
  onArticleFocusChange: (value: string) => void;
  onGenerateArticlePractice: () => void;
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
            : "break-words text-sm text-[var(--brand-ink)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function ArticlePracticeView({
  articleUrl,
  articleFocus,
  focusPlaceholder,
  provider,
  level,
  mode,
  articlePracticeResult,
  articlePracticeLoading,
  articlePracticeError,
  onArticleUrlChange,
  onArticleFocusChange,
  onGenerateArticlePractice,
}: ArticlePracticeViewProps) {
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
          Article input
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          Article Practice
        </h2>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          Turn a real article URL into copyright-safe academic speaking practice.
          The full article text is not shown or stored.
        </p>
      </div>

      <div className={`${cardBody} flex flex-col gap-5`}>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCell label="Provider" value={provider} />
            <SummaryCell label="Level" value={level} />
            <SummaryCell label="Mode" value={mode} />
          </div>

          <div className="mt-5">
            <label htmlFor="article-url" className={labelClass}>
              Article URL
            </label>
            <input
              id="article-url"
              value={articleUrl}
              onChange={(event) => onArticleUrlChange(event.target.value)}
              placeholder="https://example.com/article"
              className={inputClass}
            />
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              Paste the original source URL. The app generates practice material
              from a short server-side article extraction.
            </p>
          </div>

          <div className="mt-5">
            <label htmlFor="article-focus" className={labelClass}>
              Focus (optional)
            </label>
            <textarea
              id="article-focus"
              rows={3}
              value={articleFocus}
              onChange={(event) => onArticleFocusChange(event.target.value)}
              placeholder={focusPlaceholder || "Use the article for speaking practice"}
              className={`${inputClass} resize-y leading-6`}
            />
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              Leave blank to use Today&apos;s Target as the focus.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--brand-ink-soft)]">
              No article history, vocabulary saving, XP, or speaking attempt is
              created in this MVP view.
            </p>
            <button
              type="button"
              onClick={onGenerateArticlePractice}
              disabled={articlePracticeLoading}
              className={`${buttonPrimary} w-full sm:w-auto`}
            >
              {articlePracticeLoading
                ? "Generating practice..."
                : "Generate Practice"}
            </button>
          </div>
        </div>

        {articlePracticeError && (
          <div
            role="alert"
            className="rounded-lg border border-[var(--brand-coral)]/50 bg-[var(--brand-coral-soft)] px-4 py-3 text-sm text-[var(--brand-coral)]"
          >
            <p>{articlePracticeError}</p>
            <p className="mt-1 text-xs opacity-80">
              Check the URL, try a different article, wait a moment, or switch
              provider.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onGenerateArticlePractice}
                disabled={articlePracticeLoading}
                className="rounded-lg border border-[var(--brand-coral)]/60 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-coral)] transition-colors hover:bg-[var(--brand-coral-soft)]/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {articlePracticeLoading ? "Trying again..." : "Try Again"}
              </button>
            </div>
          </div>
        )}

        {articlePracticeResult && (
          <div className="rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Article practice result
            </h3>

            <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
              <p className={labelClass}>Article Snapshot</p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <SummaryCell
                  label="Title"
                  value={articlePracticeResult.sourceTitle}
                  multiline
                />
                <SummaryCell
                  label="Domain"
                  value={articlePracticeResult.sourceDomain}
                />
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
                    Source URL
                  </p>
                  <a
                    href={articlePracticeResult.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-words text-sm font-medium text-[var(--brand-teal-ink)] underline decoration-[var(--brand-teal)]/40 underline-offset-2"
                  >
                    {articlePracticeResult.sourceUrl}
                  </a>
                </div>
              </dl>
              <p className="mt-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-xs text-[var(--brand-ink-soft)]">
                Based on the article source. Open the original article to read
                the full text.
              </p>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <SummaryCell
                label="Brief"
                value={articlePracticeResult.articleBrief}
                multiline
              />
              <SummaryCell
                label="Main Idea"
                value={articlePracticeResult.mainIdea}
                multiline
              />
            </dl>

            <div className="mt-5 grid grid-cols-1 gap-5 border-t border-[var(--brand-border)] pt-4 lg:grid-cols-2">
              <ListSection title="Key Points" items={articlePracticeResult.keyPoints} />
              <ListSection
                title="Check Your Understanding"
                items={articlePracticeResult.comprehensionChecks}
              />
            </div>

            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <p className={labelClass}>Useful Vocabulary</p>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {articlePracticeResult.usefulVocabulary.map((item) => (
                  <li
                    key={`${item.word}-${item.meaning}`}
                    className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--brand-ink)]">
                      {item.word}
                    </p>
                    <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                      {item.meaning}
                    </p>
                    <p className="mt-2 text-xs text-[var(--brand-muted)]">
                      {item.whyUseful}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
              <p className={labelClass}>Speaking Task</p>
              <h4 className="text-base font-semibold text-[var(--brand-ink)]">
                {articlePracticeResult.speakingTask.title}
              </h4>
              <p className="mt-2 text-sm text-[var(--brand-ink)]">
                {articlePracticeResult.speakingTask.instruction}
              </p>
              <p className="mt-3 inline-flex rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-xs text-[var(--brand-ink-soft)]">
                {articlePracticeResult.speakingTask.timeLimitSeconds} seconds
              </p>
              <div className="mt-4">
                <p className={labelClass}>Target Structure</p>
                <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
                  {articlePracticeResult.speakingTask.targetStructure.map(
                    (item) => (
                      <li key={item} className="break-words">
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <ListSection
                title="Follow-Up Questions"
                items={articlePracticeResult.followUpQuestions}
              />
            </div>

            {articlePracticeResult.warnings.length > 0 && (
              <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                <ListSection title="Warnings" items={articlePracticeResult.warnings} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {title}
      </p>
      <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
