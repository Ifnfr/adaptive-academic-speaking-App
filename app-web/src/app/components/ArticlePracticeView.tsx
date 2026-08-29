

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";

type ArticleEssayTargetSkill =
  | "main_idea"
  | "supporting_detail"
  | "inference"
  | "vocabulary_in_context"
  | "critical_response";

type ArticleEssayQuestion = {
  id: string;
  question: string;
  expectedFocus: string;
  targetSkill: ArticleEssayTargetSkill;
  suggestedWordCount: {
    min: number;
    max: number;
  };
};

type ArticleEssayEvaluation = {
  overallFeedback: string;
  perQuestionFeedback: Array<{
    questionId: string;
    comprehension: string;
    topicRelevance: string;
    grammarNotes: string[];
    wordFormOrPartOfSpeechNotes: string[];
    sentenceStructureNotes: string[];
    coherenceNotes: string[];
    vocabularyNotes: string[];
    improvedAnswerExample: string;
  }>;
  recurringErrors: Array<{
    label: string;
    explanation: string;
    exampleFromUser: string;
    correction: string;
  }>;
  nextWritingFocus: string;
};

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
  essayQuestions?: ArticleEssayQuestion[];
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
  articleInputMode: "url" | "markdown" | "file";
  preparedContextMarkdown: string;
  preparedContextMarkdownError: string | null;
  articleFocus: string;
  focusPlaceholder: string;
  provider: string;
  level: string;
  mode: string;
  feedbackLanguage: "English" | "Indonesian";
  targetLanguage: string;
  articlePracticeResult: ArticlePracticeResult | null;
  articlePracticeLoading: boolean;
  articlePracticeError: string | null;
  savedVocabularyWords: ReadonlySet<string>;
  appLanguage?: AppLanguage | null;
  onArticleUrlChange: (value: string) => void;
  onArticleInputModeChange: (value: "url" | "markdown" | "file") => void;
  articleFile: { fileName: string; fileData: string } | null;
  onArticleFileChange: (
    file: { fileName: string; fileData: string } | null,
  ) => void;
  onPreparedContextMarkdownChange: (value: string) => void;
  onPreparedContextMarkdownErrorChange: (value: string | null) => void;
  onArticleFocusChange: (value: string) => void;
  onGenerateArticlePractice: () => void;
  onPracticeSpeakingTask: (result: ArticlePracticeResult) => void;
  onSaveVocabularyCandidate: (candidate: {
    word: string;
    meaning: string;
    whyUseful: string;
  }) => void;
  onEssayEvaluationComplete?: (essayResultKey: string) => void;
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

const ARTICLE_ANSWER_MAX_LENGTH = 1200;
const PREPARED_CONTEXT_MARKDOWN_MAX_LENGTH = 20_000;
const PREPARED_CONTEXT_MARKDOWN_FILE_MAX_BYTES = 150 * 1024;

const PREPARED_CONTEXT_CONVERSION_PROMPT = `Convert the reading material I provide into clean Article Context Markdown text.

Do not create a file.
Do not use tools, skills, code, or file-generation features.
Output only the final Markdown content.
Return only the Markdown content starting with "# Article Context".

Do not copy the full article. Remove references, ads, navigation text, footnotes, author bio, and formatting noise.

Use this exact Markdown structure:

# Article Context

## Title

Write the title.

## Source

Write source, author, or publication if available. If unknown, write "Unknown".

## Short Summary

Summarize the reading in 120-180 words.

## Main Idea

Explain the central idea in 1-2 sentences.

## Key Points

Write 5-8 bullet points that capture the most important arguments, facts, causes, effects, examples, or implications.

## Important Vocabulary

List 8-12 useful words or phrases. For each item, include:

* Word/Phrase:
* Meaning:
* Why useful:

## Debatable Issue

Write one issue from the reading that can be discussed from more than one perspective.

## Essay Comprehension Questions

Create exactly 5 essay questions:

1. one question about the main idea
2. one question about supporting details
3. one inference question
4. one vocabulary-in-context question
5. one critical response or implication question

For each question, include:
Question:
Expected focus:
Suggested answer length:

## Speaking Practice Prompt

Create one speaking task based on the reading. The task should ask the learner to explain, agree/disagree, compare, or respond critically.

## Follow-up Discussion Questions

Create 3 follow-up questions for speaking practice.

Keep the output concise, structured, and suitable for an English learner.`;

function getFriendlyTargetSkill(skill: ArticleEssayTargetSkill): string {
  switch (skill) {
    case "main_idea":
      return "Main idea";
    case "supporting_detail":
      return "Supporting detail";
    case "inference":
      return "Inference";
    case "vocabulary_in_context":
      return "Vocabulary in context";
    case "critical_response":
      return "Critical response";
  }
}

function getEvaluationLevel(level: string): "Beginner" | "Intermediate" | "Advanced" {
  if (level === "Intermediate") return "Intermediate";
  if (level === "Advanced" || level === "Expert") return "Advanced";
  return "Beginner";
}

function isValidEssayQuestions(
  questions: ArticlePracticeResult["essayQuestions"],
): questions is ArticleEssayQuestion[] {
  return Array.isArray(questions) && questions.length === 5;
}

function NotesList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--brand-ink-soft)]">No major notes.</p>;
  }

  return (
    <ul className="space-y-1 text-sm text-[var(--brand-ink)]">
      {items.map((item) => (
        <li key={item} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ArticlePracticeView({
  articleUrl,
  articleInputMode,
  preparedContextMarkdown,
  preparedContextMarkdownError,
  articleFocus,
  focusPlaceholder,
  provider,
  level,
  mode,
  feedbackLanguage,
  targetLanguage,
  articlePracticeResult,
  articlePracticeLoading,
  articlePracticeError,
  savedVocabularyWords,
  appLanguage,
  onArticleUrlChange,
  onArticleInputModeChange,
  articleFile,
  onArticleFileChange,
  onPreparedContextMarkdownChange,
  onPreparedContextMarkdownErrorChange,
  onArticleFocusChange,
  onGenerateArticlePractice,
  onPracticeSpeakingTask,
  onSaveVocabularyCandidate,
  onEssayEvaluationComplete,
}: ArticlePracticeViewProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [showMarkdownPrompt, setShowMarkdownPrompt] = useState(false);
  const [markdownPromptCopyStatus, setMarkdownPromptCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [essayAnswerState, setEssayAnswerState] = useState<{
    resultKey: string;
    answers: Record<string, string>;
  }>({ resultKey: "", answers: {} });
  const [essayEvaluationState, setEssayEvaluationState] = useState<{
    resultKey: string;
    value: ArticleEssayEvaluation | null;
  }>({ resultKey: "", value: null });
  const [essayEvaluationLoadingKey, setEssayEvaluationLoadingKey] =
    useState<string>("");
  const [essayEvaluationErrorState, setEssayEvaluationErrorState] = useState<{
    resultKey: string;
    message: string | null;
  }>({ resultKey: "", message: null });
  const { t } = useI18n(appLanguage);
  const essayResultKey = articlePracticeResult
    ? [
        articlePracticeResult.sourceTitle,
        articlePracticeResult.articleBrief,
        articlePracticeResult.mainIdea,
      ].join("|")
    : "";
  const essayQuestions = useMemo(
    () =>
      isValidEssayQuestions(articlePracticeResult?.essayQuestions)
        ? articlePracticeResult.essayQuestions
        : [],
    [articlePracticeResult],
  );
  const hasEssayQuestions = essayQuestions.length === 5;
  const essayAnswers = useMemo(
    () =>
      essayAnswerState.resultKey === essayResultKey
        ? essayAnswerState.answers
        : {},
    [essayAnswerState, essayResultKey],
  );
  const essayEvaluation =
    essayEvaluationState.resultKey === essayResultKey
      ? essayEvaluationState.value
      : null;
  const essayEvaluationLoading = essayEvaluationLoadingKey === essayResultKey;
  const essayEvaluationError =
    essayEvaluationErrorState.resultKey === essayResultKey
      ? essayEvaluationErrorState.message
      : null;
  const answerValidation = useMemo(() => {
    return essayQuestions.reduce<Record<string, string | null>>(
      (validation, question) => {
        const answer = essayAnswers[question.id] ?? "";
        if (answer.length > ARTICLE_ANSWER_MAX_LENGTH) {
          validation[question.id] = "Answer must be 1200 characters or fewer.";
        } else if (answer.trim().length === 0) {
          validation[question.id] = "Answer is required.";
        } else {
          validation[question.id] = null;
        }
        return validation;
      },
      {},
    );
  }, [essayAnswers, essayQuestions]);
  const canSubmitEssayAnswers =
    hasEssayQuestions &&
    !essayEvaluationLoading &&
    essayQuestions.every((question) => answerValidation[question.id] === null);

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

  const handlePreparedMarkdownChange = (value: string) => {
    onPreparedContextMarkdownChange(value);
    onPreparedContextMarkdownErrorChange(
      value.length > PREPARED_CONTEXT_MARKDOWN_MAX_LENGTH
        ? "Prepared Markdown must be 20,000 characters or fewer."
        : null,
    );
  };

  const handlePreparedMarkdownFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".md")) {
      onPreparedContextMarkdownErrorChange("Only .md files are supported.");
      return;
    }

    if (file.size > PREPARED_CONTEXT_MARKDOWN_FILE_MAX_BYTES) {
      onPreparedContextMarkdownErrorChange(
        "Markdown file must be 150 KB or smaller.",
      );
      return;
    }

    try {
      const text = await file.text();
      if (text.length > PREPARED_CONTEXT_MARKDOWN_MAX_LENGTH) {
        onPreparedContextMarkdownErrorChange(
          "Prepared Markdown must be 20,000 characters or fewer.",
        );
        return;
      }
      onPreparedContextMarkdownChange(text);
      onPreparedContextMarkdownErrorChange(null);
    } catch {
      onPreparedContextMarkdownErrorChange(
        "Could not read the Markdown file. Please try again.",
      );
    }
  };

  const [articleFileError, setArticleFileError] = useState<string | null>(null);

  const handleArticleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setArticleFileError(null);
    if (!file) {
      onArticleFileChange(null);
      return;
    }

    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setArticleFileError("Hanya file PDF atau .docx yang didukung.");
      onArticleFileChange(null);
      return;
    }

    const MAX_BYTES = 3_000_000;
    if (file.size > MAX_BYTES) {
      setArticleFileError("Ukuran file melebihi batas maksimal 3 MB.");
      onArticleFileChange(null);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setArticleFileError("Tidak dapat membaca file. Coba lagi.");
      onArticleFileChange(null);
    };
    reader.onload = () => {
      try {
        const result = reader.result;
        if (typeof result !== "string" || !result.startsWith("data:")) {
          setArticleFileError("Format file tidak valid.");
          onArticleFileChange(null);
          return;
        }
        const comma = result.indexOf(",");
        const base64 = result.slice(comma + 1);
        onArticleFileChange({ fileName: file.name, fileData: base64 });
      } catch {
        setArticleFileError("Tidak dapat membaca file. Coba lagi.");
        onArticleFileChange(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopyMarkdownPrompt = async () => {
    setMarkdownPromptCopyStatus("idle");

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard?.writeText
    ) {
      setMarkdownPromptCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(PREPARED_CONTEXT_CONVERSION_PROMPT);
      setMarkdownPromptCopyStatus("copied");
    } catch {
      setMarkdownPromptCopyStatus("failed");
    }
  };

  const handleEssayAnswerChange = (questionId: string, answer: string) => {
    setEssayAnswerState((current) => ({
      resultKey: essayResultKey,
      answers: {
        ...(current.resultKey === essayResultKey ? current.answers : {}),
        [questionId]: answer,
      },
    }));
    setEssayEvaluationErrorState({ resultKey: essayResultKey, message: null });
  };

  const handleResetWritingPractice = () => {
    setEssayAnswerState({ resultKey: essayResultKey, answers: {} });
    setEssayEvaluationState({ resultKey: essayResultKey, value: null });
    setEssayEvaluationErrorState({ resultKey: essayResultKey, message: null });
    setEssayEvaluationLoadingKey("");
  };

  const handleEvaluateWriting = async () => {
    if (!articlePracticeResult || !canSubmitEssayAnswers) return;

    setEssayEvaluationLoadingKey(essayResultKey);
    setEssayEvaluationErrorState({ resultKey: essayResultKey, message: null });
    setEssayEvaluationState({ resultKey: essayResultKey, value: null });

    try {
      const response = await fetch("/api/article-essay-evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          level: getEvaluationLevel(level),
          feedbackLanguage,
          targetLanguage,
          articleContext: {
            sourceTitle: articlePracticeResult.sourceTitle,
            articleBrief: articlePracticeResult.articleBrief,
            mainIdea: articlePracticeResult.mainIdea,
            keyPoints: articlePracticeResult.keyPoints,
          },
          questions: essayQuestions,
          answers: essayQuestions.map((question) => ({
            questionId: question.id,
            answer: essayAnswers[question.id]?.trim() ?? "",
          })),
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | ArticleEssayEvaluation
        | { error?: string }
        | null;

      if (!response.ok || !data || ("error" in data && data.error)) {
        setEssayEvaluationErrorState({
          resultKey: essayResultKey,
          message: "Writing evaluation failed. Please try again.",
        });
        return;
      }

      setEssayEvaluationState({
        resultKey: essayResultKey,
        value: data as ArticleEssayEvaluation,
      });
      onEssayEvaluationComplete?.(essayResultKey);
    } catch {
      setEssayEvaluationErrorState({
        resultKey: essayResultKey,
        message: "Writing evaluation failed. Please try again.",
      });
    } finally {
      setEssayEvaluationLoadingKey("");
    }
  };
  const card = "app-panel brand-grid";
  const cardHeader =
    "border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const labelClass =
    "app-label mb-2 block";
  const inputClass = "app-field";
  const buttonPrimary = "app-button app-button-primary";
  const buttonSecondary = "app-button app-button-secondary";
  const buttonDanger = "app-button app-button-danger";

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
        <div className="app-panel-muted p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCell label={t("article.provider")} value={provider} />
            <SummaryCell label={t("article.level")} value={level} />
            <SummaryCell label={t("article.mode")} value={mode} />
          </div>

          <div className="mt-5">
            <p className={labelClass}>Input mode</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { value: "url", label: "Article URL" },
                { value: "markdown", label: "Prepared Markdown Context" },
                { value: "file", label: "Unggah Dokumen" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    articleInputMode === option.value
                      ? "border-[var(--brand-accent-fill)] bg-[var(--brand-accent-fill)] text-[var(--brand-accent-fill-ink)]"
                      : "border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="article-input-mode"
                    value={option.value}
                    checked={articleInputMode === option.value}
                    onChange={() =>
                      onArticleInputModeChange(
                        option.value as "url" | "markdown" | "file",
                      )
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {articleInputMode === "url" && (
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
          )}

          {articleInputMode === "markdown" && (
            <div
              className="mt-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4"
              data-testid="article-markdown-input"
            >
              <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                Use a prepared Article Context Markdown
              </h3>
              <p className="mt-2 text-xs leading-5 text-[var(--brand-ink-soft)]">
                Use this when you already have Article Context Markdown from
                another tool, or want full control over the reading text. For
                PDF or Word documents, use the{" "}
                <span className="font-medium text-[var(--brand-ink)]">
                  Unggah Dokumen
                </span>{" "}
                tab instead — no conversion needed.
              </p>

              <div className="mt-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setShowMarkdownPrompt(!showMarkdownPrompt)}
                    className="inline-flex items-center gap-1.5 text-left text-sm font-semibold text-[var(--brand-ink)] hover:text-[var(--brand-teal-ink)] focus:outline-none"
                    aria-expanded={showMarkdownPrompt}
                  >
                    Prompt for another AI
                    <span className="text-xs font-normal text-[var(--brand-muted)]">
                      {showMarkdownPrompt ? "Hide" : "Show"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyMarkdownPrompt}
                    className={`${buttonSecondary} w-full px-3 py-2 text-xs sm:w-auto`}
                  >
                    Copy prompt
                  </button>
                </div>
                {markdownPromptCopyStatus === "copied" && (
                  <p className="mt-2 text-xs font-medium text-[var(--brand-teal-ink)]">
                    Prompt copied.
                  </p>
                )}
                {markdownPromptCopyStatus === "failed" && (
                  <p className="mt-2 text-xs font-medium text-[var(--brand-coral)]">
                    Copy failed. Please select and copy manually.
                  </p>
                )}
                {showMarkdownPrompt && (
                  <div className="mt-3">
                    <textarea
                      readOnly
                      rows={14}
                      value={PREPARED_CONTEXT_CONVERSION_PROMPT}
                      className={`${inputClass} resize-y font-mono text-xs leading-5`}
                      aria-label="Prompt for another AI"
                    />
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="article-markdown-file" className={labelClass}>
                  Upload .md file
                </label>
                <input
                  id="article-markdown-file"
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  onChange={handlePreparedMarkdownFileChange}
                  className="block w-full text-sm text-[var(--brand-ink)] file:mr-3 file:rounded-lg file:border file:border-[var(--brand-border)] file:bg-[var(--brand-surface-2)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--brand-ink)]"
                />
                <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                  Files are read in your browser only. Maximum size: 150 KB.
                </p>
              </div>

              <div className="mt-4">
                <label htmlFor="article-markdown" className={labelClass}>
                  Prepared Markdown Context
                </label>
                <textarea
                  id="article-markdown"
                  rows={12}
                  value={preparedContextMarkdown}
                  onChange={(event) =>
                    handlePreparedMarkdownChange(event.target.value)
                  }
                  placeholder="# Article Context&#10;&#10;## Title&#10;&#10;..."
                  className={`${inputClass} resize-y font-mono text-xs leading-5`}
                />
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className={`text-xs ${
                      preparedContextMarkdown.length >
                      PREPARED_CONTEXT_MARKDOWN_MAX_LENGTH
                        ? "text-[var(--brand-coral)]"
                        : "text-[var(--brand-ink-soft)]"
                    }`}
                  >
                    {preparedContextMarkdown.length}/
                    {PREPARED_CONTEXT_MARKDOWN_MAX_LENGTH} characters
                  </p>
                  {preparedContextMarkdownError && (
                    <p className="text-xs text-[var(--brand-coral)]">
                      {preparedContextMarkdownError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {articleInputMode === "file" && (
            <div
              className="mt-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4"
              data-testid="article-file-input"
            >
              <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                Unggah dokumen bacaan
              </h3>
              <p className="mt-2 text-xs leading-5 text-[var(--brand-ink-soft)]">
                Unggah PDF atau dokumen Word (.docx). Teks di dalam dokumen akan
                dijadikan bahan latihan — gambar diabaikan. Dokumen hasil scan
                tanpa teks (OCR) belum didukung. Maksimal 3 MB.
              </p>

              <div className="mt-4">
                <label htmlFor="article-file" className={labelClass}>
                  Pilih file PDF atau .docx
                </label>
                <input
                  id="article-file"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleArticleFileChange}
                  className="block w-full text-sm text-[var(--brand-ink)] file:mr-3 file:rounded-lg file:border file:border-[var(--brand-border)] file:bg-[var(--brand-surface-2)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--brand-ink)]"
                />
                {articleFile && (
                  <p className="mt-2 text-xs font-medium text-[var(--brand-teal-ink)]">
                    Terpilih: {articleFile.fileName}
                  </p>
                )}
                {articleFileError && (
                  <p className="mt-2 text-xs font-medium text-[var(--brand-coral)]">
                    {articleFileError}
                  </p>
                )}
                <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                  File dibaca di peramban Anda saja; tidak diunggah ke server
                  lain selain Fonetik.
                </p>
              </div>
            </div>
          )}

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
              disabled={
                articlePracticeLoading ||
                (articleInputMode === "markdown" &&
                  Boolean(preparedContextMarkdownError)) ||
                (articleInputMode === "file" && !articleFile)
              }
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
            className="app-message app-message-error"
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
                className={`${buttonDanger} min-h-9 px-3 py-1.5 text-xs`}
              >
                {articlePracticeLoading ? t("article.tryingAgain") : t("article.tryAgain")}
              </button>
            </div>
          </div>
        )}

        {articlePracticeResult && (
          <div className="app-panel-muted border-l-4 border-l-[var(--brand-teal)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              {t("article.result")}
            </h3>

            <div className="app-panel p-4">
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
              <p className="app-message mt-4 px-3 py-2 text-xs">
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
                              ? "app-button app-button-secondary min-h-8 shrink-0 cursor-default px-2.5 py-1 text-xs"
                              : "app-button app-button-primary min-h-8 shrink-0 px-2.5 py-1 text-xs"
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
              <p className="app-status mt-3">
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

            {hasEssayQuestions && (
              <div
                className="mt-5 border-t border-[var(--brand-border)] pt-4"
                data-testid="article-writing-practice"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className={labelClass}>Article Writing Practice</p>
                    <h4 className="text-base font-semibold text-[var(--brand-ink)]">
                      Answer all five comprehension questions
                    </h4>
                  </div>
                  {(essayEvaluation || essayEvaluationError) && (
                    <button
                      type="button"
                      onClick={handleResetWritingPractice}
                      className={`${buttonSecondary} min-h-9 px-3 py-2 text-xs`}
                    >
                      Reset Writing Practice
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4">
                  {essayQuestions.map((question, index) => {
                    const answer = essayAnswers[question.id] ?? "";
                    const validation = answerValidation[question.id];
                    const tooLong = answer.length > ARTICLE_ANSWER_MAX_LENGTH;

                    return (
                      <div
                        key={question.id}
                        className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4"
                        data-testid="article-essay-question-card"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                              Question {index + 1}
                            </p>
                            <h5 className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">
                              {question.question}
                            </h5>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="app-status">
                              {getFriendlyTargetSkill(question.targetSkill)}
                            </span>
                            <span className="app-status">
                              {question.suggestedWordCount.min}-
                              {question.suggestedWordCount.max} words
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-xs text-[var(--brand-ink-soft)]">
                          {question.expectedFocus}
                        </div>

                        <label
                          htmlFor={`article-essay-answer-${question.id}`}
                          className={`${labelClass} mt-4`}
                        >
                          Your answer
                        </label>
                        <textarea
                          id={`article-essay-answer-${question.id}`}
                          value={answer}
                          rows={5}
                          maxLength={ARTICLE_ANSWER_MAX_LENGTH + 200}
                          onChange={(event) =>
                            handleEssayAnswerChange(
                              question.id,
                              event.target.value,
                            )
                          }
                          className={`${inputClass} resize-y leading-6 ${
                            tooLong
                              ? "border-[var(--brand-coral)] focus:border-[var(--brand-coral)] focus:ring-[var(--brand-coral)]"
                              : ""
                          }`}
                        />
                        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p
                            className={`text-xs ${
                              tooLong
                                ? "text-[var(--brand-coral)]"
                                : "text-[var(--brand-ink-soft)]"
                            }`}
                          >
                            {answer.length}/{ARTICLE_ANSWER_MAX_LENGTH} characters
                          </p>
                          {validation && answer.length > 0 && (
                            <p className="text-xs text-[var(--brand-coral)]">
                              {validation}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {essayEvaluationError && (
                  <div
                    role="alert"
                    className="app-message app-message-error mt-4"
                  >
                    {essayEvaluationError}
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--brand-ink-soft)]">
                    All five answers are evaluated together in one request.
                  </p>
                  <button
                    type="button"
                    onClick={handleEvaluateWriting}
                    disabled={!canSubmitEssayAnswers}
                    className={`${buttonPrimary} w-full sm:w-auto`}
                  >
                    {essayEvaluationLoading
                      ? "Evaluating..."
                      : "Evaluate My Writing"}
                  </button>
                </div>

                {essayEvaluation && (
                  <div
                    className="app-panel mt-5 p-4"
                    data-testid="article-writing-evaluation"
                  >
                    <p className={labelClass}>Writing feedback</p>
                    <p className="text-sm text-[var(--brand-ink)]">
                      {essayEvaluation.overallFeedback}
                    </p>

                    <div className="mt-5 grid grid-cols-1 gap-4">
                      {essayEvaluation.perQuestionFeedback.map(
                        (feedback, index) => (
                          <div
                            key={feedback.questionId}
                            className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4"
                          >
                            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                              Question {index + 1} feedback
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                              <SummaryCell
                                label="Comprehension"
                                value={feedback.comprehension}
                                multiline
                              />
                              <SummaryCell
                                label="Topic relevance / substance"
                                value={feedback.topicRelevance}
                                multiline
                              />
                              <div>
                                <p className={labelClass}>Grammar notes</p>
                                <NotesList items={feedback.grammarNotes} />
                              </div>
                              <div>
                                <p className={labelClass}>
                                  Word form / part of speech notes
                                </p>
                                <NotesList
                                  items={
                                    feedback.wordFormOrPartOfSpeechNotes
                                  }
                                />
                              </div>
                              <div>
                                <p className={labelClass}>
                                  Sentence structure notes
                                </p>
                                <NotesList
                                  items={feedback.sentenceStructureNotes}
                                />
                              </div>
                              <div>
                                <p className={labelClass}>Coherence notes</p>
                                <NotesList items={feedback.coherenceNotes} />
                              </div>
                              <div>
                                <p className={labelClass}>
                                  Vocabulary / word choice notes
                                </p>
                                <NotesList items={feedback.vocabularyNotes} />
                              </div>
                              <SummaryCell
                                label="Improved answer example"
                                value={feedback.improvedAnswerExample}
                                multiline
                              />
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    {essayEvaluation.recurringErrors.length > 0 && (
                      <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                        <p className={labelClass}>Recurring errors</p>
                        <ul className="grid grid-cols-1 gap-3">
                          {essayEvaluation.recurringErrors.map((error) => (
                            <li
                              key={`${error.label}-${error.correction}`}
                              className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-3 text-sm"
                            >
                              <p className="font-semibold text-[var(--brand-ink)]">
                                {error.label}
                              </p>
                              <p className="mt-1 text-[var(--brand-ink)]">
                                {error.explanation}
                              </p>
                              <p className="mt-2 text-xs text-[var(--brand-muted)]">
                                Example: {error.exampleFromUser}
                              </p>
                              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                                Correction: {error.correction}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-3">
                      <p className={labelClass}>Next writing focus</p>
                      <p className="text-sm text-[var(--brand-ink)]">
                        {essayEvaluation.nextWritingFocus}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

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
