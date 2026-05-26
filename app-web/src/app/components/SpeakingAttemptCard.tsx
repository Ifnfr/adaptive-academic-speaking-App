type SpeakingAttemptCardProps = {
  transcript: string;
  displayTime: string;
  isTimerRunning: boolean;
  speechSupported: boolean;
  isListening: boolean;
  speechError: string | null;
  canSubmit: boolean;
  onTranscriptChange: (value: string) => void;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onResetTimer: () => void;
  onStartSpeechInput: () => void;
  onStopSpeechInput: () => void;
  onSubmitAttempt: () => void;
};

export function SpeakingAttemptCard({
  transcript,
  displayTime,
  isTimerRunning,
  speechSupported,
  isListening,
  speechError,
  canSubmit,
  onTranscriptChange,
  onStartTimer,
  onStopTimer,
  onResetTimer,
  onStartSpeechInput,
  onStopSpeechInput,
  onSubmitAttempt,
}: SpeakingAttemptCardProps) {
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

  return (
    <section className={card}>
      <div className={cardHeader}>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
          Step 3
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          Speaking attempt
        </h2>
      </div>
      <div className={cardBody}>
        {/* Timer */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            aria-live="polite"
            className="font-mono text-5xl tabular-nums text-[var(--brand-ink)]"
          >
            {displayTime}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onStartTimer}
              disabled={isTimerRunning}
              className={buttonSecondary}
            >
              Start Timer
            </button>
            <button
              type="button"
              onClick={onStopTimer}
              disabled={!isTimerRunning}
              className={buttonSecondary}
            >
              Stop Timer
            </button>
            <button
              type="button"
              onClick={onResetTimer}
              className={buttonSecondary}
            >
              Reset Timer
            </button>
          </div>
        </div>

        {/* Speech Input */}
        <div className="mt-6 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-[var(--brand-ink)]">
                Speech input
              </h3>
              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                Browser speech-to-text. Audio stays on your device.
              </p>
            </div>
            {speechSupported ? (
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={onStartSpeechInput}
                  disabled={isListening}
                  className={buttonSecondary}
                >
                  Start Speech Input
                </button>
                <button
                  type="button"
                  onClick={onStopSpeechInput}
                  disabled={!isListening}
                  className={buttonSecondary}
                >
                  Stop Speech Input
                </button>
              </div>
            ) : null}
          </div>

          {speechSupported ? (
            <p
              aria-live="polite"
              className="mt-3 text-xs text-[var(--brand-ink-soft)]"
            >
              {isListening
                ? "Listening… speak clearly. Recognized text will be appended below."
                : "Speech input accuracy depends on your browser and microphone. You can edit the transcript before submitting."}
            </p>
          ) : (
            <p className="mt-3 text-xs text-[var(--brand-ink-soft)]">
              Speech input is not supported in this browser. Please type or
              paste your transcript manually.
            </p>
          )}

          {speechError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-[var(--brand-coral)]/40 bg-[var(--brand-coral-soft)] px-3 py-2 text-xs text-[var(--brand-coral)]"
            >
              {speechError}
            </p>
          )}
        </div>

        {/* Transcript */}
        <div className="mt-6">
          <label htmlFor="transcript" className={labelClass}>
            Transcript
          </label>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            rows={8}
            placeholder="Type or paste what you said during the attempt..."
            className={`${inputClass} resize-y leading-6`}
          />
        </div>

        {/* Submit */}
        <div className="mt-5">
          <button
            type="button"
            onClick={onSubmitAttempt}
            disabled={!canSubmit}
            className={`${buttonPrimary} w-full sm:w-auto`}
          >
            Submit Attempt
          </button>
        </div>
      </div>
    </section>
  );
}
