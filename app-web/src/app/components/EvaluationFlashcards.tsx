"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleEvaluationCard } from "./BubbleEvaluationCard";
import type { PodchatEvaluateResponse } from "./PodchatView";
import type {
  PodchatBubbleEvaluation,
  PodchatBubbleSummary,
} from "../api/podchat/evaluate-bubbles/route";

export interface EvaluationFlashcardsProps {
  evalData: PodchatEvaluateResponse;
  bubbleSummary: PodchatBubbleSummary | null;
  bubbleEvals: Record<string, PodchatBubbleEvaluation | null>;
  bubbleEvalLoading: Record<string, boolean>;
  bubbleEvalErrors: Record<string, string | null>;
  learnerTurns: Array<{ id: string; text: string }>;
  onEvaluateBubble: (turnId: string) => void;
  onStartQuiz: () => void;
  onStartNew: () => void;
  quizActive?: boolean;
  resetKey?: number;
  onAddVocabulary?: (
    suggestion: string,
    example: string,
  ) => Promise<"added" | "duplicate">;
}

const TOTAL_CARDS = 7;
const EMPTY_MESSAGE = "Nothing to review for this session.";

const ASPECT_FEEDBACK_LABELS: Array<{
  key: keyof NonNullable<PodchatEvaluateResponse["aspectFeedback"]>;
  label: string;
}> = [
  { key: "sentenceStructure", label: "Sentence Structure" },
  { key: "grammar", label: "Grammar" },
  { key: "coherence", label: "Coherence" },
  { key: "topicRelevance", label: "Topic Relevance / Substance" },
  { key: "ideaDevelopment", label: "Idea Development" },
  { key: "conversationalResponsiveness", label: "Conversational Responsiveness" },
];

const labelClass = "app-label mb-2";
const buttonPrimary = "app-button app-button-primary";
const buttonSecondary = "app-button app-button-secondary";
const cardShellClass =
  "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid overflow-hidden";
const cardHeaderClass =
  "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
const headerRowClass = cardHeaderClass + " flex items-start justify-between gap-3";
const cardBodyClass = "min-h-[420px] max-h-[560px] overflow-y-auto p-6";
const fullViewBodyClass = "max-h-[70vh] overflow-y-auto p-6 sm:p-8";

const CARD_TITLES: Array<{ micro: string; title: string }> = [
  { micro: "Evaluation", title: "Summary" },
  { micro: "Evaluation", title: "Aspect Feedback" },
  { micro: "Evaluation", title: "Corrections / Grammar Notes" },
  { micro: "Evaluation", title: "Better Sentence Examples" },
  { micro: "Evaluation", title: "Vocabulary Suggestions" },
  { micro: "Evaluation", title: "Recurring Errors" },
  { micro: "Bubble Feedback", title: "Evaluate each of your responses" },
];

export function EvaluationFlashcards({
  evalData,
  bubbleSummary,
  bubbleEvals,
  bubbleEvalLoading,
  bubbleEvalErrors,
  learnerTurns,
  onEvaluateBubble,
  onStartQuiz,
  onStartNew,
  quizActive = false,
  resetKey,
  onAddVocabulary,
}: EvaluationFlashcardsProps) {
  const [cardNumber, setCardNumber] = useState(1);
  const [deckComplete, setDeckComplete] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [vocabAddState, setVocabAddState] = useState<{
    index: number;
    status: "saving" | "added" | "duplicate";
  } | null>(null);
  const vocabRevertTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setCardNumber(1);
    setDeckComplete(false);
  }, [resetKey]);

  useEffect(() => {
    return () => {
      if (vocabRevertTimerRef.current !== null) {
        window.clearTimeout(vocabRevertTimerRef.current);
      }
    };
  }, []);

  const goPrevious = useCallback(() => {
    if (cardNumber <= 1) return;
    setCardNumber(cardNumber - 1);
  }, [cardNumber]);

  const goNext = useCallback(() => {
    if (cardNumber >= TOTAL_CARDS) return;
    const next = cardNumber + 1;
    setCardNumber(next);
    if (next === TOTAL_CARDS) {
      setDeckComplete(true);
    }
  }, [cardNumber]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Escape") {
        setFullViewOpen(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        goPrevious();
      } else if (event.key === "ArrowRight") {
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrevious, goNext]);

  // Lock body scroll while the full-view overlay is open; restore on close/unmount.
  useEffect(() => {
    if (!fullViewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullViewOpen]);

  // Auto-close the overlay when the quiz starts.
  useEffect(() => {
    if (quizActive && fullViewOpen) {
      setFullViewOpen(false);
    }
  }, [quizActive, fullViewOpen]);

  const activeCardClass = (index: number) =>
    cardNumber === index ? cardShellClass : "hidden";

  const handleAddVocab = (
    index: number,
    suggestion: string,
    example: string,
  ) => {
    if (!onAddVocabulary) return;
    setVocabAddState({ index, status: "saving" });
    void onAddVocabulary(suggestion, example)
      .then((result) => {
        setVocabAddState({ index, status: result });
        if (vocabRevertTimerRef.current !== null) {
          window.clearTimeout(vocabRevertTimerRef.current);
        }
        vocabRevertTimerRef.current = window.setTimeout(() => {
          setVocabAddState(null);
          vocabRevertTimerRef.current = null;
        }, 2000);
      })
      .catch(() => {
        setVocabAddState(null);
      });
  };

  const renderExpandIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
    </svg>
  );

  const renderCloseIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );

  const renderExpandButton = (n: number) => (
    <button
      type="button"
      onClick={() => setFullViewOpen(true)}
      aria-label="Expand card"
      title="Full view"
      data-testid={`podchat-eval-fullview-${n}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--brand-muted)] transition-colors hover:bg-[var(--brand-surface-2)] hover:text-[var(--brand-teal)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]"
    >
      {renderExpandIcon()}
    </button>
  );

  const renderHeaderLeft = (n: number) => (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
        {CARD_TITLES[n - 1]?.micro}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
        {CARD_TITLES[n - 1]?.title}
      </h2>
    </div>
  );

  // ── Card body renderers (shared between the inline deck and full view) ──

  const renderSummaryBody = () => (
    <>
      <h3 className={labelClass}>Summary</h3>
      <p className="text-sm leading-6 text-[var(--brand-ink-soft)]">{evalData.summary}</p>
      <div className="mt-6 border-t border-[var(--brand-border)] pt-5">
        <h3 className={labelClass}>Next practice focus</h3>
        <p className="text-sm leading-6 text-[var(--brand-ink-soft)]">
          {evalData.nextPracticeFocus}
        </p>
      </div>
    </>
  );

  const renderAspectFeedbackBody = () => (
    <>
      <h3 className={labelClass}>Aspect Feedback</h3>
      {evalData.aspectFeedback ? (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ASPECT_FEEDBACK_LABELS.map(({ key, label }) => {
            const item = evalData.aspectFeedback?.[key];
            if (!item?.message) return null;
            const displayText =
              item.status === "excellent" ? "Excellent" : item.message;
            return (
              <div
                key={key}
                className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                  {label}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--brand-ink-soft)]">
                  {displayText}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm italic text-[var(--brand-ink-soft)]">{EMPTY_MESSAGE}</p>
      )}
    </>
  );

  const renderCorrectionsBody = () => (
    <>
      <h3 className={labelClass}>Corrections / Grammar Notes</h3>
      {evalData.corrections.length > 0 ? (
        <div className="mt-2 flex flex-col gap-3">
          {evalData.corrections.map((c, i) => (
            <div key={i} className="app-panel-muted p-4">
              <p className="text-xs text-[var(--brand-coral)] line-through">
                &quot;{c.original}&quot;
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--brand-success-ink)]">
                &quot;{c.improved}&quot;
              </p>
              <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">{c.explanation}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-[var(--brand-ink-soft)]">{EMPTY_MESSAGE}</p>
      )}
    </>
  );

  const renderBetterSentencesBody = () => (
    <>
      <h3 className={labelClass}>Better sentence examples</h3>
      {evalData.betterSentences.length > 0 ? (
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[var(--brand-ink-soft)]">
          {evalData.betterSentences.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-[var(--brand-ink-soft)]">{EMPTY_MESSAGE}</p>
      )}
    </>
  );

  const renderVocabularyBody = () => (
    <>
      <h3 className={labelClass}>Vocabulary suggestions</h3>
      {evalData.vocabularySuggestions.length > 0 ? (
        <div className="mt-2 flex flex-col gap-3">
          {evalData.vocabularySuggestions.map((v, i) => {
            const isSaving =
              vocabAddState?.index === i && vocabAddState.status === "saving";
            const isAdded =
              vocabAddState?.index === i &&
              (vocabAddState.status === "added" ||
                vocabAddState.status === "duplicate");
            const isDuplicate =
              vocabAddState?.index === i &&
              vocabAddState.status === "duplicate";
            const available = Boolean(onAddVocabulary);
            return (
              <div key={i} className="app-panel-muted p-4">
                <p className="text-sm font-semibold text-[var(--brand-ink)]">
                  Instead of{" "}
                  <span className="underline decoration-[var(--brand-coral)]">
                    {v.originalOrBasic}
                  </span>
                  , try:{" "}
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[var(--brand-teal)]">{v.suggestion}</span>
                    <button
                      type="button"
                      disabled={isSaving || !available}
                      onClick={() => handleAddVocab(i, v.suggestion, v.example)}
                      aria-busy={isSaving}
                      aria-label={
                        isAdded
                          ? "Added to vocabulary notebook"
                          : `Add "${v.suggestion}" to vocabulary notebook`
                      }
                      title={
                        !available
                          ? "Vocabulary notebook unavailable"
                          : isDuplicate
                            ? "Already in your notebook"
                            : isAdded
                              ? "Added to vocabulary notebook"
                              : "Add to vocabulary notebook"
                      }
                      data-testid={
                        isAdded
                          ? `podchat-vocab-added-${i}`
                          : `podchat-vocab-add-${i}`
                      }
                      className={
                        "inline-flex h-6 w-6 items-center justify-center rounded-full border text-sm font-bold leading-none transition-colors " +
                        (isAdded
                          ? isDuplicate
                            ? "border-[var(--brand-border)] text-[var(--brand-muted)]"
                            : "border-[var(--brand-teal)] bg-[var(--brand-teal)] text-white"
                          : "border-[var(--brand-teal)] text-[var(--brand-teal)] hover:bg-[var(--brand-teal)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50")
                      }
                    >
                      {isSaving ? "…" : isAdded ? "✓" : "+"}
                    </button>
                  </span>
                </p>
                <p className="mt-2 text-xs italic text-[var(--brand-ink-soft)]">
                  Example: &quot;{v.example}&quot;
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm italic text-[var(--brand-ink-soft)]">{EMPTY_MESSAGE}</p>
      )}
    </>
  );

  const renderRecurringErrorsBody = () => (
    <>
      <h3 className={labelClass}>Recurring Errors</h3>
      {evalData.recurringErrors.length > 0 ? (
        <div className="mt-2 flex flex-col gap-3">
          {evalData.recurringErrors.map((re, i) => (
            <div key={i} className="app-panel-muted p-4">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">{re.label}</p>
              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                Evidence: <span className="italic">&quot;{re.evidence}&quot;</span>
              </p>
              <p className="mt-2 text-xs text-[var(--brand-teal-ink)]">
                Practice: {re.practiceFocus}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-[var(--brand-ink-soft)]">{EMPTY_MESSAGE}</p>
      )}
    </>
  );

  const renderBubbleFeedbackBody = () => (
    <>
      <p className="text-sm text-[var(--brand-ink-soft)]">
        Every answer you gave is evaluated on its own: what worked, what to fix, a stronger
        version, and one thing to practice.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {learnerTurns.length === 0 ? (
          <p className="text-sm italic text-[var(--brand-ink-soft)]">{EMPTY_MESSAGE}</p>
        ) : (
          <>
            {bubbleSummary && (
              <div
                className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4"
                data-testid="podchat-bubble-summary"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
                    Session summary
                  </p>
                  <span
                    className={
                      bubbleSummary.overallStatus === "strong"
                        ? "app-status app-status-success"
                        : bubbleSummary.overallStatus === "developing"
                          ? "app-status app-status-info"
                          : "app-status app-status-warning"
                    }
                  >
                    {bubbleSummary.overallStatus === "strong"
                      ? "Strong"
                      : bubbleSummary.overallStatus === "developing"
                        ? "Developing"
                        : "Needs work"}
                  </span>
                </div>
                {bubbleSummary.topWeaknesses.length > 0 && (
                  <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 text-sm leading-6 text-[var(--brand-ink-soft)]">
                    {bubbleSummary.topWeaknesses.map((weakness, i) => (
                      <li
                        key={`weakness-${i}`}
                        data-testid={`podchat-bubble-weakness-${i}`}
                      >
                        <span className="font-semibold text-[var(--brand-ink)]">
                          {weakness.label}
                        </span>{" "}
                        ({weakness.count}×) — {weakness.evidence}{" "}
                        <span className="text-[var(--brand-teal)]">
                          {weakness.practiceFocus}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p
                  className="mt-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-3 text-sm leading-6 text-[var(--brand-ink)]"
                  data-testid="podchat-bubble-next-focus"
                >
                  <span className="font-semibold">Next practice focus: </span>
                  {bubbleSummary.nextPracticeFocus}
                </p>
              </div>
            )}

            {learnerTurns.map((t) => (
              <BubbleEvaluationCard
                key={t.id}
                turnId={t.id}
                learnerText={t.text}
                evaluation={bubbleEvals[t.id] ?? null}
                loading={Boolean(bubbleEvalLoading[t.id])}
                error={bubbleEvalErrors[t.id] ?? null}
                onEvaluate={() => onEvaluateBubble(t.id)}
              />
            ))}
          </>
        )}
      </div>
    </>
  );

  const renderCardBody = (n: number) => {
    switch (n) {
      case 2:
        return renderAspectFeedbackBody();
      case 3:
        return renderCorrectionsBody();
      case 4:
        return renderBetterSentencesBody();
      case 5:
        return renderVocabularyBody();
      case 6:
        return renderRecurringErrorsBody();
      case 7:
        return renderBubbleFeedbackBody();
      default:
        return renderSummaryBody();
    }
  };

  const renderNavRow = () => (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={goPrevious}
        disabled={cardNumber === 1}
        className={buttonSecondary}
        data-testid="podchat-eval-prev"
      >
        Previous
      </button>
      <p
        className="text-sm font-medium text-[var(--brand-ink-soft)]"
        data-testid="podchat-eval-progress"
      >
        Card {cardNumber} of {TOTAL_CARDS}
      </p>
      <button
        type="button"
        onClick={goNext}
        disabled={cardNumber === TOTAL_CARDS}
        className={buttonPrimary}
        data-testid="podchat-eval-next"
      >
        {cardNumber === TOTAL_CARDS ? "Finish Review" : "Next"}
      </button>
    </div>
  );

  const renderFooterRow = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--brand-border)] pt-4">
      <button type="button" onClick={onStartNew} className={buttonSecondary}>
        Start New Podchat
      </button>
      {!quizActive && (
        <div className="flex flex-wrap items-center gap-3">
          {!deckComplete && (
            <p className="text-xs text-[var(--brand-ink-soft)]">
              Finish reviewing the cards to unlock the quiz.
            </p>
          )}
          <button
            type="button"
            onClick={onStartQuiz}
            disabled={!deckComplete}
            className={buttonPrimary}
            data-testid="podchat-start-quiz"
          >
            Start Quiz
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl" data-testid="podchat-evaluation-deck">
      <section className="flex flex-col gap-4" data-testid="podchat-evaluation-success">
        <section className={activeCardClass(1)} data-testid="podchat-eval-card-1">
          <div className={headerRowClass}>
            {renderHeaderLeft(1)}
            {renderExpandButton(1)}
          </div>
          <div className={cardBodyClass}>{renderCardBody(1)}</div>
        </section>

        <section className={activeCardClass(2)} data-testid="podchat-eval-card-2">
          <div className={headerRowClass}>
            {renderHeaderLeft(2)}
            {renderExpandButton(2)}
          </div>
          <div className={cardBodyClass}>{renderCardBody(2)}</div>
        </section>

        <section className={activeCardClass(3)} data-testid="podchat-eval-card-3">
          <div className={headerRowClass}>
            {renderHeaderLeft(3)}
            {renderExpandButton(3)}
          </div>
          <div className={cardBodyClass}>{renderCardBody(3)}</div>
        </section>

        <section className={activeCardClass(4)} data-testid="podchat-eval-card-4">
          <div className={headerRowClass}>
            {renderHeaderLeft(4)}
            {renderExpandButton(4)}
          </div>
          <div className={cardBodyClass}>{renderCardBody(4)}</div>
        </section>

        <section className={activeCardClass(5)} data-testid="podchat-eval-card-5">
          <div className={headerRowClass}>
            {renderHeaderLeft(5)}
            {renderExpandButton(5)}
          </div>
          <div className={cardBodyClass}>{renderCardBody(5)}</div>
        </section>

        <section className={activeCardClass(6)} data-testid="podchat-eval-card-6">
          <div className={headerRowClass}>
            {renderHeaderLeft(6)}
            {renderExpandButton(6)}
          </div>
          <div className={cardBodyClass}>{renderCardBody(6)}</div>
        </section>

        <section className={activeCardClass(7)} data-testid="podchat-eval-card-7">
          <div className={headerRowClass}>
            {renderHeaderLeft(7)}
            {renderExpandButton(7)}
          </div>
          <div className={cardBodyClass} data-testid="podchat-bubble-evaluations">
            {renderCardBody(7)}
          </div>
        </section>

        {renderNavRow()}
        {renderFooterRow()}
      </section>

      {fullViewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          data-testid="podchat-eval-fullview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Full view of card ${cardNumber}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFullViewOpen(false);
            }
          }}
        >
          <div className="w-full max-w-4xl">
            <section className={cardShellClass}>
              <div className={headerRowClass}>
                {renderHeaderLeft(cardNumber)}
                <button
                  type="button"
                  onClick={() => setFullViewOpen(false)}
                  aria-label="Close full view"
                  data-testid="podchat-eval-fullview-close"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--brand-muted)] transition-colors hover:bg-[var(--brand-surface-2)] hover:text-[var(--brand-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]"
                >
                  {renderCloseIcon()}
                </button>
              </div>
              <div className={fullViewBodyClass}>{renderCardBody(cardNumber)}</div>
              <div className="flex flex-col gap-4 p-6">
                {renderNavRow()}
                {renderFooterRow()}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
