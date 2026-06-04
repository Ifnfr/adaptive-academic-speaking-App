

import { useState } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";

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
  savedVocabularyWords: ReadonlySet<string>;
  appLanguage?: AppLanguage | null;
  onArticleUrlChange: (value: string) => void;
  onArticleFocusChange: (value: string) => void;
  onGenerateArticlePractice: () => void;
  onPracticeSpeakingTask: (result: ArticlePracticeResult) => void;
  onSaveVocabularyCandidate: (candidate: {
    word: string;
    meaning: string;
    whyUseful: string;
  }) => void;
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
  savedVocabularyWords,
  appLanguage,
  onArticleUrlChange,
  onArticleFocusChange,
  onGenerateArticlePractice,
  onPracticeSpeakingTask,
  onSaveVocabularyCandidate,
}: ArticlePracticeViewProps) {
  const [showHelp, setShowHelp] = useState(false);
  const { t } = useI18n(appLanguage);
  const isWordSaved = (word: string): boolean => {
    return savedVocabularyWords.has(word.trim().toLowerCase());
  };

  const handleSaveWord = (candidate: {
    word: string;
    meaning: string;
    whyUseful: string;
  }) => {
    if (isWordSaved(candidate.word)) return;
    onSaveVocabularyCandidate(candidate);
  };
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
          {t("article.input")}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          {t("article.title")}
        </h2>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          {t("article.tagline")}
        </p>
      </div>

      <div className={`${cardBody} flex flex-col gap-5`}>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCell label={t("article.provider")} value={provider} />
            <SummaryCell label={t("article.level")} value={level} />
            <SummaryCell label={t("article.mode")} value={mode} />
          </div>

          <div className="mt-5">
            <label htmlFor="article-url" className={labelClass}>
              {t("article.url")}
            </label>
            <input
              id="article-url"
              value={articleUrl}
              onChange={(event) => onArticleUrlChange(event.target.value)}
              placeholder="https://example.com/article"
              className={inputClass}
            />
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              {t("article.urlTagline")}
            </p>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-teal-ink)] hover:underline focus:outline-none"
              >
                <span>{showHelp ? "Hide help" : "What article links work best?"}</span>
                <svg
                  className={`h-3 w-3 transition-transform ${showHelp ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showHelp && (
                <div className="mt-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-xs leading-5 text-[var(--brand-ink)]">
                  <p className="font-semibold text-[var(--brand-ink)]">
                    What article links work best?
                  </p>
                  <p className="mt-1 text-[var(--brand-ink-soft)]">
                    Use public article pages that can be opened without login or paywall. The article should have readable text directly on the page.
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-[var(--brand-muted)] uppercase tracking-wide text-[10px]">
                        Works best with...
                      </p>
                      <ul className="mt-1 list-disc pl-4 space-y-1 text-[var(--brand-ink-soft)]">
                        <li>News articles</li>
                        <li>Opinion essays</li>
                        <li>Educational blogs</li>
                        <li>Economics or technology explainers</li>
                        <li>Research/institution blog posts</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-[var(--brand-muted)] uppercase tracking-wide text-[10px]">
                        Avoid
                      </p>
                      <ul className="mt-1 list-disc pl-4 space-y-1 text-[var(--brand-ink-soft)]">
                        <li>Instagram, TikTok, X/Twitter, LinkedIn posts</li>
                        <li>YouTube pages</li>
                        <li>PDF files</li>
                        <li>Pages requiring login or heavy JavaScript</li>
                        <li>Heavily paywalled articles</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[var(--brand-border)] pt-3">
                    <p className="font-semibold text-[var(--brand-muted)] uppercase tracking-wide text-[10px]">
                      Try public article pages from...
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <span className="font-medium text-[var(--brand-ink)] block">Indonesia:</span>
                        <p className="mt-0.5 text-[var(--brand-ink-soft)]">
                          The Conversation Indonesia, Katadata, CNBC Indonesia, Bisnis, Kontan, Kompas.com, Tempo.co, Tirto, Kumparan
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-[var(--brand-ink)] block">International:</span>
                        <p className="mt-0.5 text-[var(--brand-ink-soft)]">
                          BBC, Reuters, AP News, The Guardian, Al Jazeera, CNBC, Vox, The Conversation, MIT News, World Bank Blogs, IMF Blog, Our World in Data
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded border border-[var(--brand-coral)]/30 bg-[var(--brand-coral-soft)]/20 p-2.5 text-[var(--brand-coral)]">
                    <span className="font-semibold block">Caution:</span> Some articles may fail because of paywalls, login walls, scripts, or anti-bot protection. Not every article from these sources will work. If extraction fails, try another public article link.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="article-focus" className={labelClass}>
              {t("article.focus")}
            </label>
            <textarea
              id="article-focus"
              rows={3}
              value={articleFocus}
              onChange={(event) => onArticleFocusChange(event.target.value)}
              placeholder={focusPlaceholder || t("article.focusPlaceholder")}
              className={`${inputClass} resize-y leading-6`}
            />
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              {t("article.focusTagline")}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--brand-ink-soft)]">
              {t("article.viewTagline")}
            </p>
            <button
              type="button"
              onClick={onGenerateArticlePractice}
              disabled={articlePracticeLoading}
              className={`${buttonPrimary} w-full sm:w-auto`}
            >
              {articlePracticeLoading
                ? t("article.generating")
                : t("article.generateBtn")}
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
              {t("article.errorTagline")}
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onGenerateArticlePractice}
                disabled={articlePracticeLoading}
                className="rounded-lg border border-[var(--brand-coral)]/60 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-coral)] transition-colors hover:bg-[var(--brand-coral-soft)]/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {articlePracticeLoading ? t("article.tryingAgain") : t("article.tryAgain")}
              </button>
            </div>
          </div>
        )}

        {articlePracticeResult && (
          <div className="rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              {t("article.result")}
            </h3>

            <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
              <p className={labelClass}>{t("article.snapshot")}</p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <SummaryCell
                  label={t("article.snapTitle")}
                  value={articlePracticeResult.sourceTitle}
                  multiline
                />
                <SummaryCell
                  label={t("article.snapDomain")}
                  value={articlePracticeResult.sourceDomain}
                />
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
                    {t("article.sourceUrl")}
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
                {t("article.snapTagline")}
              </p>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <SummaryCell
                label={t("article.brief")}
                value={articlePracticeResult.articleBrief}
                multiline
              />
              <SummaryCell
                label={t("article.mainIdea")}
                value={articlePracticeResult.mainIdea}
                multiline
              />
            </dl>

            <div className="mt-5 grid grid-cols-1 gap-5 border-t border-[var(--brand-border)] pt-4 lg:grid-cols-2">
              <ListSection title={t("article.keyPoints")} items={articlePracticeResult.keyPoints} />
              <ListSection
                title={t("article.checkUnderstanding")}
                items={articlePracticeResult.comprehensionChecks}
              />
            </div>

            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <p className={labelClass}>{t("article.usefulVocab")}</p>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {articlePracticeResult.usefulVocabulary.map((item) => {
                  const saved = isWordSaved(item.word);
                  return (
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
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-[10px] leading-tight text-[var(--brand-muted)]">
                          {t("article.vocabSaveInstruction")}
                        </p>
                        <button
                          type="button"
                          disabled={saved}
                          onClick={() => handleSaveWord(item)}
                          className={
                            saved
                              ? "shrink-0 rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-2.5 py-1 text-xs text-[var(--brand-muted)] cursor-default"
                              : "shrink-0 rounded-md border border-[var(--brand-teal)]/50 bg-[var(--brand-teal)]/10 px-2.5 py-1 text-xs font-medium text-[var(--brand-teal-ink)] transition-colors hover:bg-[var(--brand-teal)]/20 focus:outline-none focus:ring-1 focus:ring-[var(--brand-teal)]"
                          }
                        >
                          {saved ? t("vocab.wordSaved") : t("vocab.saveToNotebook")}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
              <p className={labelClass}>{t("article.speakingTask")}</p>
              <h4 className="text-base font-semibold text-[var(--brand-ink)]">
                {articlePracticeResult.speakingTask.title}
              </h4>
              <p className="mt-2 text-sm text-[var(--brand-ink)]">
                {articlePracticeResult.speakingTask.instruction}
              </p>
              <p className="mt-3 inline-flex rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-xs text-[var(--brand-ink-soft)]">
                {articlePracticeResult.speakingTask.timeLimitSeconds} {t("article.seconds")}
              </p>
              <div className="mt-4">
                <p className={labelClass}>{t("article.targetStructure")}</p>
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
              <div className="mt-5 flex flex-col gap-2 border-t border-[var(--brand-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--brand-ink-soft)]">
                  {t("article.taskTagline")}
                </p>
                <button
                  type="button"
                  onClick={() => onPracticeSpeakingTask(articlePracticeResult)}
                  className={`${buttonPrimary} w-full sm:w-auto`}
                >
                  {t("article.practiceTaskBtn")}
                </button>
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
              <ListSection
                title={t("article.followUp")}
                items={articlePracticeResult.followUpQuestions}
              />
            </div>

            {articlePracticeResult.warnings.length > 0 && (
              <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                <ListSection title={t("article.warnings")} items={articlePracticeResult.warnings} />
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
