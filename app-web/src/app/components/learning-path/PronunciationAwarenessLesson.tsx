"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState } from "react";

export type PronunciationAwarenessLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  contract: MicroPracticeContract;
  appLanguage?: AppLanguage | null;
};

export function PronunciationAwarenessLesson({
  card,
  contract,
}: PronunciationAwarenessLessonProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"none" | "success" | "retry">("none");
  const [recordState, setRecordState] = useState<"idle" | "speaking" | "recorded">("idle");
  const [listenModelActive, setListenModelActive] = useState(false);
  const [listenAActive, setListenAActive] = useState(false);
  const [listenBActive, setListenBActive] = useState(false);

  const focus = card.pronunciationFocus;
  const isMalformed = !focus || !Array.isArray(focus.pairs) || focus.pairs.length === 0;

  // Speak text using browser SpeechSynthesis fallback
  const speakText = (text: string, onStart: () => void, onEnd: () => void) => {
    onStart();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(onEnd, 1500);
    }
  };

  const handleListenModel = () => {
    speakText(
      card.targetPhrases.join(". "),
      () => setListenModelActive(true),
      () => setListenModelActive(false)
    );
  };

  const handleListenA = (word: string) => {
    speakText(
      word,
      () => setListenAActive(true),
      () => setListenAActive(false)
    );
  };

  const handleListenB = (word: string) => {
    speakText(
      word,
      () => setListenBActive(true),
      () => setListenBActive(false)
    );
  };

  const handleSelectChoice = (word: string, correctWord: string) => {
    setSelectedWord(word);
    contract.actions.startAttempt();

    if (word === correctWord) {
      setFeedback("success");
    } else {
      setFeedback("retry");
      contract.actions.markAttempted();
    }
  };

  const handleStartSpeaking = () => {
    setRecordState("speaking");
    contract.actions.startAttempt();
  };

  const handleStopAttempt = () => {
    setRecordState("recorded");
    contract.actions.markRecorded();
  };

  const handleTryAgain = () => {
    setRecordState("idle");
    contract.actions.resetLocalAttempt();
  };

  if (isMalformed) {
    // Malformed fallback rendering
    return (
      <div className="flex flex-col gap-6" data-testid="pronunciation-awareness-lesson">
        <div>
          <h2 className="text-xl font-bold text-[var(--brand-ink)]" data-testid="lesson-card-title">
            {card.title}
          </h2>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]" data-testid="lesson-learner-instruction">
            {card.learnerInstruction}
          </p>
          <p className="mt-1 text-xs italic text-[var(--brand-muted)]">
            {card.indonesianExplanation}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-center flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Target focus sounds: /θ/ and /ð/
          </span>
          <div className="flex flex-col gap-1.5 font-mono text-[var(--brand-ink)]">
            {card.targetPhrases.map((phrase, idx) => (
              <span key={idx} className="text-sm font-semibold">{phrase}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => contract.actions.continueAnyway()}
              className="flex-1 rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
              data-testid="continue-btn"
            >
              Continue anyway
            </button>

            <button
              onClick={() => contract.actions.completeWithSupport()}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-all shadow-sm focus:outline-none"
              data-testid="complete-btn"
            >
              Completed with support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pick first pair for MVP
  const pair = focus.pairs[0];
  const correctWord = pair.correct === "A" ? pair.wordA : pair.wordB;

  const isCompleteAllowed = selectedWord !== null && recordState === "recorded";

  return (
    <div className="flex flex-col gap-6" data-testid="pronunciation-awareness-lesson">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-[var(--brand-ink)] animate-fade-in" data-testid="lesson-card-title">
          {card.title}
        </h2>
        <p className="mt-2 text-sm text-[var(--brand-ink-soft)]" data-testid="lesson-learner-instruction">
          {card.learnerInstruction}
        </p>
        <p className="mt-1 text-xs italic text-[var(--brand-muted)]">
          {card.indonesianExplanation}
        </p>
      </div>

      {/* Focus Sound Banner */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 flex flex-col gap-1 items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Focus Sound
        </span>
        <span className="text-3xl font-black text-[var(--brand-teal-ink)] tracking-wider" data-testid="pronunciation-focus-sound">
          /θ/ & /ð/
        </span>
      </div>

      {/* Model Playback */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 flex flex-col items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Model Target Phrases
        </span>
        <div className="flex flex-wrap gap-2 justify-center font-mono font-bold text-[var(--brand-ink)] text-sm">
          {card.targetPhrases.map((phrase, idx) => (
            <span key={idx} className="border border-[var(--brand-border)] rounded-md px-2 py-0.5 bg-white">
              {phrase}
            </span>
          ))}
        </div>
        <button
          onClick={handleListenModel}
          disabled={listenModelActive}
          className={`flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-white px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50 focus:outline-none ${
            listenModelActive ? "text-sky-600 border-sky-200 bg-sky-50" : "text-[var(--brand-ink)]"
          }`}
          data-testid="listen-pronunciation-model-btn"
        >
          🔊 {listenModelActive ? "Playing Model..." : "Listen to Model"}
        </button>
      </div>

      {/* Minimal Pair Sound Contrast Selector */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Minimal Pair Sound Contrast
        </span>

        <div className="grid grid-cols-2 gap-4">
          {/* Word A */}
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--brand-border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-[10px] font-bold text-gray-400">Option A</span>
              <button
                onClick={() => handleListenA(pair.wordA)}
                disabled={listenAActive}
                className="text-xs text-[var(--brand-ink-soft)] hover:text-gray-900 border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded px-2 py-0.5 focus:outline-none"
                data-testid="listen-pronunciation-option-btn"
              >
                🔊 Play
              </button>
            </div>
            <button
              onClick={() => handleSelectChoice(pair.wordA, correctWord)}
              className={`py-3.5 rounded-lg border text-base font-bold font-mono text-center transition-all ${
                selectedWord === pair.wordA
                  ? "bg-[var(--brand-teal-soft)] border-[var(--brand-teal)] text-[var(--brand-teal-ink)]"
                  : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700"
              }`}
              data-testid="pronunciation-pair-option"
            >
              {pair.wordA}
            </button>
          </div>

          {/* Word B */}
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--brand-border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-[10px] font-bold text-gray-400">Option B</span>
              <button
                onClick={() => handleListenB(pair.wordB)}
                disabled={listenBActive}
                className="text-xs text-[var(--brand-ink-soft)] hover:text-gray-900 border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded px-2 py-0.5 focus:outline-none"
                data-testid="listen-pronunciation-option-btn"
              >
                🔊 Play
              </button>
            </div>
            <button
              onClick={() => handleSelectChoice(pair.wordB, correctWord)}
              className={`py-3.5 rounded-lg border text-base font-bold font-mono text-center transition-all ${
                selectedWord === pair.wordB
                  ? "bg-[var(--brand-teal-soft)] border-[var(--brand-teal)] text-[var(--brand-teal-ink)]"
                  : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700"
              }`}
              data-testid="pronunciation-pair-option"
            >
              {pair.wordB}
            </button>
          </div>
        </div>
      </div>

      {/* Selected Preview Box & Speaking Arena */}
      {selectedWord && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 flex flex-col gap-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Selected Pronunciation
          </span>
          <p className="text-xl font-mono font-black text-[var(--brand-teal-ink)] text-center animate-fade-in" data-testid="selected-pronunciation-choice">
            {selectedWord}
          </p>

          <div className="flex flex-col items-center justify-center gap-3 border-t border-[var(--brand-border)] pt-4 mt-2">
            <div className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
              recordState === "speaking"
                ? "bg-red-100 text-red-600 animate-pulse border-4 border-red-200"
                : recordState === "recorded"
                  ? "bg-emerald-100 text-emerald-600 border-4 border-emerald-200"
                  : "bg-gray-100 text-gray-500 border-4 border-gray-200"
            }`}>
              {recordState === "speaking" ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="5" y="5" width="10" height="10" rx="1" />
                </svg>
              ) : recordState === "recorded" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </div>
            <p className="text-xs text-[var(--brand-ink-soft)]">
              {recordState === "speaking"
                ? "Listening... Read the word clearly."
                : recordState === "recorded"
                  ? "Speaking attempt recorded locally."
                  : "Practice pronunciation of the word locally."}
            </p>

            <div className="flex gap-2">
              {recordState === "idle" && (
                <button
                  onClick={handleStartSpeaking}
                  className="rounded-xl px-5 py-2 text-xs font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:bg-gray-50 hover:border-gray-300 transition-colors focus:outline-none"
                  data-testid="start-pronunciation-speaking-btn"
                >
                  Start speaking
                </button>
              )}
              {recordState === "speaking" && (
                <button
                  onClick={handleStopAttempt}
                  className="rounded-xl px-5 py-2 text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors focus:outline-none"
                  data-testid="stop-pronunciation-speaking-btn"
                >
                  Stop attempt
                </button>
              )}
              {recordState === "recorded" && (
                <button
                  onClick={handleTryAgain}
                  className="rounded-xl px-5 py-2 text-xs font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
                  data-testid="retry-pronunciation-speaking-btn"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {feedback === "success" && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-xs font-medium animate-bounce-subtle"
          data-testid="builder-feedback-success"
        >
          🎉 Good. You noticed the target sound. Nice listening. This sound can be tricky.
        </div>
      )}
      {feedback === "retry" && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-xs font-medium"
          data-testid="builder-feedback-retry"
        >
          💡 Try listening again and compare the two sounds. Practice the model once more when you are ready.
        </div>
      )}

      {/* Privacy Note */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
        <p className="text-xs text-[var(--brand-muted)]" data-testid="privacy-note">
          This is a sound-awareness practice. No speech is scored or stored. Your voice is not stored or uploaded. Complete with support when you are ready.
        </p>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => contract.actions.continueAnyway()}
            className="flex-1 rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
            data-testid="continue-btn"
          >
            Continue anyway
          </button>

          <button
            onClick={() => contract.actions.completeWithSupport()}
            className={`rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition-all shadow-sm focus:outline-none ${
              isCompleteAllowed
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
            }`}
            data-testid="complete-pronunciation-awareness-btn"
            disabled={!isCompleteAllowed}
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
