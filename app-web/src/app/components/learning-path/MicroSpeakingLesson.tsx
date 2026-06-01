"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState, useEffect, useRef } from "react";
import { canUseTutorVoice, speakTutorPhrase } from "../../lib/speech/tutor-voice";

export type MicroSpeakingLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  contract: MicroPracticeContract;
  appLanguage?: AppLanguage | null;
};

export function MicroSpeakingLesson({
  card,
  contract,
}: MicroSpeakingLessonProps) {
  const isFluencySprint = card.speakingMode === "fluency-sprint";
  const sprintLimits = card.timeLimitsSeconds && card.timeLimitsSeconds.length > 0
    ? card.timeLimitsSeconds
    : [30, 20, 15];

  // Standard states
  const [recordState, setRecordState] = useState<"idle" | "recording" | "recorded">("idle");

  // Fluency Sprint states
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(sprintLimits[0]);
  const [isSprintActive, setIsSprintActive] = useState(false);
  const [attemptRecorded, setAttemptRecorded] = useState(false);
  const [timerStatus, setTimerStatus] = useState<"idle" | "running" | "ended">("idle");
  const [listenActive, setListenActive] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer countdown hook for fluency sprint
  useEffect(() => {
    if (isSprintActive && remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsSprintActive(false);
            setRecordState("recorded");
            setAttemptRecorded(true);
            setTimerStatus("ended");
            contract.actions.markRecorded();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isSprintActive, remainingSeconds, contract.actions]);

  // Model voice synthesis playback
  const handleListenModel = async () => {
    contract.actions.startAttempt();
    setListenActive(true);

    if (canUseTutorVoice()) {
      await speakTutorPhrase(card.targetPhrases.join(". "));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setListenActive(false);
  };

  // Standard modes
  const handleStartRecording = () => {
    setRecordState("recording");
    contract.actions.startAttempt();
  };

  const handleStopRecording = () => {
    setRecordState("recorded");
    contract.actions.markRecorded();
  };

  const handleRetry = () => {
    setRecordState("idle");
    contract.actions.resetLocalAttempt();
  };

  // Fluency sprint modes
  const handleStartSprint = () => {
    setRecordState("recording");
    setTimerStatus("running");
    setRemainingSeconds(sprintLimits[currentRoundIndex]);
    setIsSprintActive(true);
    contract.actions.startAttempt();
  };

  const handleStopAttempt = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsSprintActive(false);
    setRecordState("recorded");
    setAttemptRecorded(true);
    setTimerStatus("idle");
    contract.actions.markRecorded();
  };

  const handleRetrySprint = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsSprintActive(false);
    setRecordState("idle");
    setTimerStatus("idle");
    setRemainingSeconds(sprintLimits[currentRoundIndex]);
    contract.actions.resetLocalAttempt();
  };

  const handleNextRound = () => {
    if (currentRoundIndex < sprintLimits.length - 1) {
      const nextIndex = currentRoundIndex + 1;
      setCurrentRoundIndex(nextIndex);
      setRemainingSeconds(sprintLimits[nextIndex]);
    }
    setRecordState("idle");
    setTimerStatus("idle");
    contract.actions.resetLocalAttempt();
  };

  if (isFluencySprint) {
    const isCompleted = attemptRecorded && recordState === "recorded";
    const allRoundsFinished = isCompleted && currentRoundIndex === sprintLimits.length - 1 && timerStatus !== "ended";

    return (
      <div className="flex flex-col gap-6" data-testid="fluency-sprint-lesson">
        {/* Title & Timing Info */}
        <div>
          <h2 className="text-xl font-bold text-[var(--brand-ink)] animate-fade-in" data-testid="lesson-card-title">
            {card.title}
          </h2>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
            {card.learnerInstruction}
          </p>
          <p className="mt-1 text-xs italic text-[var(--brand-muted)]">
            {card.indonesianExplanation}
          </p>
        </div>

        {/* Sprint Target Phrase Box */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-center flex flex-col items-center gap-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Sprint Target Phrase
          </span>
          <div className="flex flex-col gap-2">
            {card.targetPhrases.map((phrase, idx) => (
              <span
                key={idx}
                className="text-2xl font-extrabold tracking-tight text-[var(--brand-teal-ink)] font-mono"
                data-testid="target-phrase"
              >
                {phrase}
              </span>
            ))}
          </div>
          {card.scaffold && (
            <p className="text-xs text-[var(--brand-ink-soft)] border-t border-[var(--brand-border)] pt-2 w-full">
              Format: <span className="font-mono">{card.scaffold}</span>
            </p>
          )}

          <button
            onClick={handleListenModel}
            disabled={listenActive}
            className={`flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-white px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50 focus:outline-none ${
              listenActive ? "text-sky-600 border-sky-200 bg-sky-50" : "text-[var(--brand-ink)]"
            }`}
            data-testid="play-model-btn"
          >
            🔊 {listenActive ? "Playing..." : "Listen to Model"}
          </button>
        </div>

        {/* Sprint Progress Steps */}
        <div className="flex items-center justify-between gap-2 p-3 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-xl text-xs font-medium" data-testid="sprint-steps-container">
          <span className="text-[10px] uppercase font-bold text-[var(--brand-muted)]">Sprint sequence:</span>
          <div className="flex items-center gap-1.5 font-mono text-[var(--brand-ink)]">
            {sprintLimits.map((limit, idx) => (
              <span
                key={idx}
                className={`px-2.5 py-1 rounded border transition-all duration-200 ${
                  idx === currentRoundIndex
                    ? "bg-amber-500/10 text-amber-700 border-amber-500/30 font-bold scale-105"
                    : idx < currentRoundIndex
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100 opacity-60"
                      : "bg-gray-50 text-gray-400 border-gray-100 opacity-50"
                }`}
                data-testid={`sprint-step-${limit}`}
              >
                {limit}s
              </span>
            ))}
          </div>
        </div>

        {/* Timer and Recording Arena */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
          <div className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            <span>Fluency Arena</span>
            <span data-testid="sprint-round-indicator">Round {currentRoundIndex + 1} of {sprintLimits.length}</span>
          </div>

          <div className="flex flex-col items-center gap-3 text-center my-2">
            <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 transition-all duration-300 ${
              isSprintActive
                ? "bg-red-50 border-red-200 text-red-600 scale-105"
                : isCompleted
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                  : "bg-white border-[var(--brand-border)] text-gray-500"
            }`}>
              <span className="text-2xl font-black font-mono leading-none" data-testid="timer-countdown">
                {remainingSeconds}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-65 mt-0.5">sec left</span>
            </div>

            {timerStatus === "ended" ? (
              <p className="text-sm font-semibold text-amber-600" data-testid="sprint-status-msg">
                Nice effort. Try again with support when you are ready.
              </p>
            ) : (
              <p className="text-xs text-[var(--brand-ink-soft)]" data-testid="sprint-status-msg">
                {isSprintActive
                  ? "Sprint active! Speak target phrase immediately."
                  : isCompleted
                    ? allRoundsFinished
                      ? "All sprint rounds completed! Excellent job!"
                      : `Round ${currentRoundIndex + 1} attempt recorded.`
                    : `Speak target phrase within ${sprintLimits[currentRoundIndex]} seconds.`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {recordState === "idle" && (
              <button
                onClick={handleStartSprint}
                className="rounded-xl px-5 py-2.5 text-xs font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:border-[var(--brand-teal)] hover:bg-gray-50 transition-colors shadow-sm focus:outline-none"
                data-testid="start-sprint-btn"
              >
                Start sprint
              </button>
            )}

            {recordState === "recording" && (
              <button
                onClick={handleStopAttempt}
                className="rounded-xl px-5 py-2.5 text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors shadow-sm focus:outline-none"
                data-testid="stop-sprint-btn"
              >
                Stop attempt
              </button>
            )}

            {isCompleted && (
              <button
                onClick={handleRetrySprint}
                className="rounded-xl px-5 py-2.5 text-xs font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:bg-gray-50 transition-colors shadow-sm focus:outline-none"
                data-testid="retry-sprint-btn"
              >
                Try again
              </button>
            )}

            {isCompleted && !allRoundsFinished && (
              <button
                onClick={handleNextRound}
                className="rounded-xl px-5 py-2.5 text-xs font-semibold bg-[var(--brand-teal-soft)] border border-[var(--brand-teal)]/20 text-[var(--brand-teal-ink)] hover:bg-[var(--brand-surface-2)] transition-colors shadow-sm focus:outline-none"
                data-testid="next-round-btn"
              >
                Next round
              </button>
            )}
          </div>
        </div>

        {/* Privacy Note */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
          <p className="text-xs text-[var(--brand-muted)]" data-testid="privacy-note">
            Your voice is not stored or uploaded. This sprint tracks completion only, not speech content.
          </p>
        </div>

        {/* Sprint Footer Actions */}
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
                attemptRecorded
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
              }`}
              data-testid="complete-btn"
              disabled={!attemptRecorded}
            >
              Completed with support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard speaking mode fallback
  return (
    <div className="flex flex-col gap-6" data-testid="micro-speaking-lesson">
      {/* Title & Indonesian Explanation */}
      <div>
        <h2 className="text-xl font-bold text-[var(--brand-ink)]" data-testid="lesson-card-title">
          {card.title}
        </h2>
        <p className="mt-2 text-sm italic text-[var(--brand-ink-soft)]">
          {card.indonesianExplanation}
        </p>
      </div>

      {/* Target Phrases Box */}
      <div className="rounded-xl bg-[var(--brand-surface-2)] p-4 border border-[var(--brand-border)]">
        <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider block">
          Target Phrases
        </span>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm font-mono text-[var(--brand-ink)]" data-testid="target-phrases-hint-list">
          {card.targetPhrases.map((phrase, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="text-[var(--brand-teal-ink)]">•</span>
              {phrase}
            </li>
          ))}
        </ul>

        {card.scaffold && (
          <div className="mt-4 border-t border-[var(--brand-border)] pt-3">
            <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider block">
              Practice Format / Scaffold
            </span>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]" data-testid="scaffold-text">
              {card.scaffold}
            </p>
          </div>
        )}
      </div>

      {/* Interactive Mock Recording Area */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)] self-start w-full">
          Safe Speaking Practice
        </span>
        
        <div className="flex flex-col items-center gap-3 text-center my-4">
          <div className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
            recordState === "recording" 
              ? "bg-red-100 text-red-600 animate-pulse border-4 border-red-200" 
              : recordState === "recorded"
                ? "bg-emerald-100 text-emerald-600 border-4 border-emerald-200"
                : "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] border-4 border-[var(--brand-teal)]/20"
          }`}>
            {recordState === "recording" ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <rect x="5" y="5" width="10" height="10" rx="1" />
              </svg>
            ) : recordState === "recorded" ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
          
          <p className="text-sm font-medium text-[var(--brand-ink)]">
            {recordState === "recording" 
              ? "Listening... Read the phrases clearly." 
              : recordState === "recorded"
                ? "Attempt recorded locally."
                : "Tap to simulate speaking attempt."}
          </p>
        </div>

        <div className="flex gap-3">
          {recordState === "idle" && (
            <button
              onClick={handleStartRecording}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:border-[var(--brand-teal)] transition-colors shadow-sm focus:outline-none"
              data-testid="start-record-btn"
            >
              Start attempt
            </button>
          )}

          {recordState === "recording" && (
            <button
              onClick={handleStopRecording}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors shadow-sm focus:outline-none"
              data-testid="stop-record-btn"
            >
              Stop recording
            </button>
          )}

          {recordState === "recorded" && (
            <button
              onClick={handleRetry}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:bg-gray-50 transition-colors shadow-sm focus:outline-none"
              data-testid="retry-record-btn"
            >
              Try again
            </button>
          )}
        </div>
      </div>

      {/* Interactive Action CTA */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex items-center justify-between text-[11px] text-[var(--brand-ink-soft)]">
          <span>Complete the speaking attempt to proceed</span>
        </div>

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
              recordState === "recorded"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
            }`}
            data-testid="complete-btn"
            disabled={recordState !== "recorded"}
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
