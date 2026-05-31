"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState } from "react";

export type SupportedConversationLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  contract: MicroPracticeContract;
  appLanguage?: AppLanguage | null;
};

export function SupportedConversationLesson({
  card,
  contract,
}: SupportedConversationLessonProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedOptionText, setSelectedOptionText] = useState<string | null>(null);
  const [recordState, setRecordState] = useState<"idle" | "speaking" | "recorded">("idle");
  const [listenTutorActive, setListenTutorActive] = useState(false);
  const [listenResponseActive, setListenResponseActive] = useState(false);

  const prompt = card.conversationPrompt;

  // Safe fallback check
  const isMalformed = !prompt || !prompt.tutorTurn || !Array.isArray(prompt.options) || prompt.options.length === 0;

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

  const handleListenTutor = () => {
    if (isMalformed) return;
    speakText(
      prompt.tutorTurn,
      () => setListenTutorActive(true),
      () => setListenTutorActive(false)
    );
  };

  const handleListenResponse = () => {
    if (!selectedOptionText) return;
    speakText(
      selectedOptionText,
      () => setListenResponseActive(true),
      () => setListenResponseActive(false)
    );
  };

  const handleSelectOption = (option: { id: string; text: string }) => {
    setSelectedOptionId(option.id);
    setSelectedOptionText(option.text);
    // Reset speaking states when choice changes
    setRecordState("idle");
    setProgState("selected");
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

  // Helper to set intermediate states if needed
  const [, setProgState] = useState<"idle" | "selected">("idle");

  if (isMalformed) {
    // Standard safe internal fallback when prompt is malformed or missing
    return (
      <div className="flex flex-col gap-6" data-testid="supported-conversation-lesson">
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
            Practice target phrases:
          </span>
          <div className="flex flex-col gap-1.5 font-mono text-[var(--brand-ink)]">
            {card.targetPhrases.map((phrase, idx) => (
              <span key={idx} className="text-sm font-semibold">{phrase}</span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
          <p className="text-xs text-[var(--brand-muted)]" data-testid="privacy-note">
            Your voice is not stored or uploaded. This practice tracks completion only, not speech content.
          </p>
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

  const isCompleteAllowed = selectedOptionId !== null && recordState === "recorded";

  return (
    <div className="flex flex-col gap-6" data-testid="supported-conversation-lesson">
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

      {/* Tutor Turn Box */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Tutor Prompt
          </span>
          <button
            onClick={handleListenTutor}
            disabled={listenTutorActive}
            className={`flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-white px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-gray-50 focus:outline-none ${
              listenTutorActive ? "text-sky-600 border-sky-200 bg-sky-50" : "text-[var(--brand-ink)]"
            }`}
            data-testid="listen-tutor-prompt-btn"
          >
            🔊 {listenTutorActive ? "Playing..." : "Listen"}
          </button>
        </div>
        <p className="text-lg font-bold text-[var(--brand-ink)]" data-testid="supported-conversation-prompt">
          {prompt.tutorTurn}
        </p>
      </div>

      {/* Scripted Options */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Choose a safe response, then practice saying it aloud.
        </span>
        <div className="flex flex-col gap-2" data-testid="conversation-options-box">
          {prompt.options.map((opt) => {
            const isSelected = selectedOptionId === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelectOption(opt)}
                className={`w-full text-left rounded-xl p-3.5 text-sm font-semibold border transition-all duration-150 shadow-sm focus:outline-none ${
                  isSelected
                    ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] border-[var(--brand-teal)]/30 scale-[1.01]"
                    : "bg-white text-[var(--brand-ink)] border-[var(--brand-border)] hover:bg-gray-50 hover:border-gray-300"
                }`}
                data-testid="supported-conversation-option"
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Option Visualizer and Speaking Arena */}
      {selectedOptionId && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
              Your Response Preview
            </span>
            <button
              onClick={handleListenResponse}
              disabled={listenResponseActive}
              className={`flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-white px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-gray-50 focus:outline-none ${
                listenResponseActive ? "text-sky-600 border-sky-200 bg-sky-50" : "text-[var(--brand-ink)]"
              }`}
              data-testid="listen-selected-response-btn"
            >
              🔊 {listenResponseActive ? "Playing..." : "Listen"}
            </button>
          </div>
          <p className="text-base font-bold text-[var(--brand-teal-ink)] font-mono" data-testid="selected-response-preview">
            {selectedOptionText}
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
                ? "Listening... Read your response clearly."
                : recordState === "recorded"
                  ? "Speaking attempt recorded locally."
                  : "Practice saying your response aloud."}
            </p>

            <div className="flex gap-2">
              {recordState === "idle" && (
                <button
                  onClick={handleStartSpeaking}
                  className="rounded-xl px-5 py-2 text-xs font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:bg-gray-50 hover:border-gray-300 transition-colors focus:outline-none"
                  data-testid="start-supported-speaking-btn"
                >
                  Start speaking
                </button>
              )}
              {recordState === "speaking" && (
                <button
                  onClick={handleStopAttempt}
                  className="rounded-xl px-5 py-2 text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors focus:outline-none"
                  data-testid="stop-supported-speaking-btn"
                >
                  Stop attempt
                </button>
              )}
              {recordState === "recorded" && (
                <button
                  onClick={handleTryAgain}
                  className="rounded-xl px-5 py-2 text-xs font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
                  data-testid="retry-supported-speaking-btn"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Privacy disclaimer */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
        <p className="text-xs text-[var(--brand-muted)]" data-testid="privacy-note">
          This is a scripted practice. No speech is scored or stored. Your voice is not stored or uploaded. Complete with support when you are ready.
        </p>
      </div>

      {/* Actions */}
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
            data-testid="complete-supported-conversation-btn"
            disabled={!isCompleteAllowed}
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
