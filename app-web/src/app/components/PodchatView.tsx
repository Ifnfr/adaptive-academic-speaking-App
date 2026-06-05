"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PodchatPhase =
  | "setup"
  | "speaking"
  | "evaluation";
type PodchatTopic = "Economics" | "Technology";
type PodchatDifficulty = "Beginner" | "Intermediate" | "Advanced";
type PodchatStatus = "host_turn" | "user_turn" | "submitting" | "complete";
type PodchatSpeaker = "host" | "learner";
type RecordingState = "idle" | "recording" | "transcribing" | "ready";

type PodchatTurn = {
  id: string;
  speaker: PodchatSpeaker;
  text: string;
};

type PodchatCorrection = {
  original: string;
  improved: string;
  explanation: string;
};

type PodchatVocabularySuggestion = {
  originalOrBasic: string;
  suggestion: string;
  example: string;
};

type PodchatRecurringError = {
  label: string;
  evidence: string;
  practiceFocus: string;
};

type PodchatAspectFeedbackItem = {
  status: "excellent" | "needs_improvement";
  message: string;
};

type PodchatAspectFeedback = {
  sentenceStructure: PodchatAspectFeedbackItem;
  grammar: PodchatAspectFeedbackItem;
  coherence: PodchatAspectFeedbackItem;
  topicRelevance: PodchatAspectFeedbackItem;
};

type PodchatEvaluateResponse = {
  summary: string;
  corrections: PodchatCorrection[];
  betterSentences: string[];
  vocabularySuggestions: PodchatVocabularySuggestion[];
  recurringErrors: PodchatRecurringError[];
  nextPracticeFocus: string;
  aspectFeedback?: PodchatAspectFeedback;
};

const TOPICS: readonly PodchatTopic[] = ["Economics", "Technology"];
const DIFFICULTIES: readonly PodchatDifficulty[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

/** Duration-based session limits — replaces the old max-turn model. */
const DIFFICULTY_DURATION: Record<PodchatDifficulty, number> = {
  Beginner: 180,    // 3 minutes
  Intermediate: 300, // 5 minutes
  Advanced: 420,    // 7 minutes
};

const DIFFICULTY_LABEL: Record<PodchatDifficulty, string> = {
  Beginner: "3-minute session",
  Intermediate: "5-minute session",
  Advanced: "7-minute session",
};

const ASPECT_FEEDBACK_LABELS: Array<{
  key: keyof PodchatAspectFeedback;
  label: string;
}> = [
  { key: "sentenceStructure", label: "Sentence Structure" },
  { key: "grammar", label: "Grammar" },
  { key: "coherence", label: "Coherence" },
  { key: "topicRelevance", label: "Topic Relevance / Substance" },
];

const HOST_OPENERS: Record<PodchatTopic, string> = {
  Economics:
    "Welcome to Podchat. Let's discuss how everyday prices influence the choices people make. What example from daily life would you like to start with?",
  Technology:
    "Welcome to Podchat. Let's explore how technology changes the way people study and work. Which technology trend feels most important to you right now?",
};

const LEARNER_REPLIES: Record<PodchatTopic, readonly string[]> = {
  Economics: [
    "I think prices affect daily decisions because people compare what they want with what they can afford.",
    "For example, when transport costs rise, students may choose cheaper routes or reduce non-essential spending.",
    "This shows a trade-off because limited income forces people to prioritize the most useful option.",
    "Businesses may also react by changing prices, offering discounts, or reducing costs in their operations.",
    "The main risk is that people with lower income have fewer choices when prices change quickly.",
    "In my opinion, economic pressure is not only about money but also about confidence and planning.",
    "Overall, small price changes can create large effects when many people adjust their behavior together.",
  ],
  Technology: [
    "I think technology changes learning because people can access information faster and practice more independently.",
    "For example, students can use online platforms to review lessons, record ideas, and receive quick feedback.",
    "However, technology can also distract learners if they use too many tools without a clear purpose.",
    "Workers may benefit from automation, but they also need new skills to stay relevant in their jobs.",
    "Privacy is important because learning tools may collect personal data and study habits.",
    "In the next few years, I think AI tools will become normal assistants for writing, speaking, and research.",
    "Overall, technology is most useful when people use it intentionally rather than depending on it completely.",
  ],
};

function speakerLabel(speaker: PodchatSpeaker): string {
  return speaker === "host" ? "AI host" : "Learner";
}

function statusLabel(status: PodchatStatus, isTtsSpeaking: boolean): string {
  if (status === "host_turn") return "Host speaking";
  if (status === "user_turn") return isTtsSpeaking ? "Host speaking..." : "Your turn";
  if (status === "submitting") return "Processing";
  return "Complete";
}

function nextTurnId(turns: ReadonlyArray<PodchatTurn>): string {
  return `podchat-turn-${turns.length + 1}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type PodchatArticleContext = {
  articleTitle: string;
  articleBrief: string;
  mainIdea?: string;
  keyPoints?: string[];
  speakingTaskTitle: string;
  speakingTaskInstruction: string;
  targetStructure?: string[];
  sourceDomain?: string;
};

export interface PodchatViewProps {
  articleContext?: PodchatArticleContext | null;
  onClearArticleContext?: () => void;
}

export function PodchatView({
  articleContext,
  onClearArticleContext,
}: PodchatViewProps) {
  const [phase, setPhase] = useState<PodchatPhase>("setup");
  const [topic, setTopic] = useState<PodchatTopic>("Technology");
  const [difficulty, setDifficulty] =
    useState<PodchatDifficulty>("Intermediate");
  const [status, setStatus] = useState<PodchatStatus>("host_turn");
  const [turns, setTurns] = useState<PodchatTurn[]>([]);
  const [submittedUserTurns, setSubmittedUserTurns] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [lockedTranscript, setLockedTranscript] = useState<string | null>(null);

  // Duration-based session state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionActiveRef = useRef(false);

  // API / feedback states
  const [turnError, setTurnError] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalData, setEvalData] = useState<PodchatEvaluateResponse | null>(null);

  // TTS audio playback states and refs
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // MediaRecorder and microphone audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const durationSeconds = DIFFICULTY_DURATION[difficulty];
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
  const isTimeExpired = remainingSeconds === 0;
  const isLastTurnLearner = turns.length > 0 && turns[turns.length - 1].speaker === "learner";
  const hasSubmitError = !!turnError && isLastTurnLearner;
  const rollingTurns = turns.slice(-3);
  const fullTranscript = useMemo(
    () =>
      turns
        .map((turn) => `${speakerLabel(turn.speaker)}: ${turn.text}`)
        .join("\n\n"),
    [turns],
  );

  const buttonPrimary =
    "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";

  // --- Timer management ---
  function startTimer() {
    sessionActiveRef.current = true;
    timerRef.current = setInterval(() => {
      if (!sessionActiveRef.current) return;
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }

  function stopTimer() {
    sessionActiveRef.current = false;
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function cleanupAudio() {
    setIsTtsSpeaking(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
        // ignore
      }
      objectUrlRef.current = null;
    }
  }

  function cleanupMedia() {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }

    audioChunksRef.current = [];
  }

  async function playTts(text: string) {
    cleanupAudio();
    setTtsError(null);
    setIsTtsSpeaking(true);

    try {
      const response = await fetch("/api/podchat/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error("TTS request failed");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        setIsTtsSpeaking(false);
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
      });

      audio.addEventListener("error", () => {
        setIsTtsSpeaking(false);
        setTtsError("Voice unavailable. Continuing with text.");
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
      });

      await audio.play();
    } catch {
      setIsTtsSpeaking(false);
      setTtsError("Voice unavailable. Continuing with text.");
      if (objectUrlRef.current) {
        try {
          URL.revokeObjectURL(objectUrlRef.current);
        } catch {
          // ignore
        }
        objectUrlRef.current = null;
      }
    }
  }

  // Clean up timer and audio on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      cleanupAudio();
      cleanupMedia();
    };
  }, []);

  // When time expires during speaking, allow End Session automatically if
  // the user is idle and has at least one learner turn.
  // State updates are deferred via setTimeout to avoid calling setState
  // synchronously inside an effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (phase !== "speaking") return;
    if (!isTimeExpired) return;
    if (status === "submitting") return; // let the in-flight request finish
    if (status === "complete") return;
    const hasLearnerTurn = turns.some((t) => t.speaker === "learner");
    if (hasLearnerTurn) {
      stopTimer();
      const currentTurns = turns;
      setTimeout(() => {
        cleanupAudio();
        cleanupMedia();
        setStatus("complete");
        setPhase("evaluation");
        triggerEvaluation(currentTurns);
      }, 0);
    } else {
      setTimeout(() => {
        setTurnError("Time is up. At least one turn is needed for evaluation. Please start a new Podchat.");
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeExpired, phase, status]);

  function startPodchat() {
    cleanupAudio();
    cleanupMedia();
    const opener: PodchatTurn = {
      id: "podchat-turn-1",
      speaker: "host",
      text: HOST_OPENERS[topic],
    };
    setTurns([opener]);
    setSubmittedUserTurns(0);
    setElapsedSeconds(0);
    setStatus("user_turn");
    setPhase("speaking");
    setTurnError(null);
    setEvalError(null);
    setEvalData(null);
    setRecordingState("idle");
    setLockedTranscript(null);
    startTimer();
  }

  function resetPodchat() {
    stopTimer();
    cleanupAudio();
    cleanupMedia();
    setPhase("setup");
    setStatus("host_turn");
    setTurns([]);
    setSubmittedUserTurns(0);
    setElapsedSeconds(0);
    setTurnError(null);
    setEvalError(null);
    setEvalData(null);
    setRecordingState("idle");
    setLockedTranscript(null);
    if (onClearArticleContext) {
      onClearArticleContext();
    }
  }

  async function startRecording() {
    setTurnError(null);
    setLockedTranscript(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        } else if (MediaRecorder.isTypeSupported("audio/wav")) {
          mimeType = "audio/wav";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (mediaStreamRef.current) {
          try {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          } catch {
            // ignore
          }
          mediaStreamRef.current = null;
        }

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setTurnError("No speech recorded. Please try again.");
          setRecordingState("idle");
          return;
        }

        const blobMimeType = recorder.mimeType || mimeType;
        const audioBlob = new Blob(chunks, { type: blobMimeType });
        audioChunksRef.current = [];

        setRecordingState("transcribing");

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, `speech.${blobMimeType.split("/")[1] || "webm"}`);

          const response = await fetch("/api/podchat/stt", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || "Transcription failed. Please try recording again.");
          }

          const data = await response.json();
          if (data.transcript && typeof data.transcript === "string") {
            setLockedTranscript(data.transcript);
            setRecordingState("ready");
          } else {
            throw new Error("Speech transcription failed. Please try again later.");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setTurnError(msg || "Transcription failed. Please try recording again.");
          setRecordingState("idle");
        }
      };

      recorder.start();
      setRecordingState("recording");
    } catch (err: unknown) {
      console.error("Microphone access or recorder initialization failed:", err);
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        } catch {
          // ignore
        }
        mediaStreamRef.current = null;
      }
      setTurnError("Microphone access was denied. Please allow microphone access and try again.");
      setRecordingState("idle");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error("Error stopping MediaRecorder:", e);
      }
    }
  }

  function discardRecording() {
    cleanupMedia();
    setRecordingState("idle");
    setLockedTranscript(null);
  }

  async function triggerEvaluation(finalTurns: PodchatTurn[]) {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const response = await fetch("/api/podchat/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          difficulty,
          turns: finalTurns.map((t) => ({ speaker: t.speaker, text: t.text })),
          ...(articleContext ? { articleContext } : {}),
        }),
      });
      if (!response.ok) {
        const errText = await response.json().catch(() => ({}));
        throw new Error(errText.error || "Failed to evaluate session.");
      }
      const data = await response.json();
      setEvalData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEvalError(msg || "An error occurred during evaluation.");
    } finally {
      setEvalLoading(false);
    }
  }

  function buildTurnPayload(currentTurns: PodchatTurn[], currentIndex: number) {
    const elapsed = elapsedSeconds;
    const remaining = Math.max(0, durationSeconds - elapsed);
    return {
      topic,
      difficulty,
      turnIndex: currentIndex,
      durationSeconds,
      elapsedSeconds: elapsed,
      remainingSeconds: remaining,
      turns: currentTurns.map((t) => ({ speaker: t.speaker, text: t.text })),
      ...(articleContext ? { articleContext } : {}),
    };
  }

  async function retryLastTurn() {
    setTurnError(null);
    setStatus("submitting");
    try {
      const response = await fetch("/api/podchat/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTurnPayload(turns, submittedUserTurns)),
      });
      if (!response.ok) {
        const errText = await response.json().catch(() => ({}));
        throw new Error(errText.error || "Failed to submit turn.");
      }
      const data = await response.json();
      const hostTurn: PodchatTurn = {
        id: `podchat-turn-${turns.length + 1}`,
        speaker: "host",
        text: `${data.hostText} ${data.followUpQuestion}`,
      };
      const updatedTurns = [...turns, hostTurn];
      setTurns(updatedTurns);
      const nextSubmittedCount = submittedUserTurns + 1;
      setSubmittedUserTurns(nextSubmittedCount);
      setStatus("user_turn");

      // Reset recording state after successful host response
      setLockedTranscript(null);
      setRecordingState("idle");

      playTts(`${data.hostText} ${data.followUpQuestion}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTurnError(msg || "An error occurred. Please try again.");
      setStatus("user_turn");
    }
  }

  async function submitTurn() {
    if (status !== "user_turn") return;
    const learnerText = lockedTranscript || LEARNER_REPLIES[topic][0];
    const learnerTurn: PodchatTurn = {
      id: nextTurnId(turns),
      speaker: "learner",
      text: learnerText,
    };
    const updatedTurns = [...turns, learnerTurn];
    setTurns(updatedTurns);
    setTurnError(null);
    setStatus("submitting");

    try {
      const response = await fetch("/api/podchat/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTurnPayload(updatedTurns, submittedUserTurns)),
      });
      if (!response.ok) {
        const errText = await response.json().catch(() => ({}));
        throw new Error(errText.error || "Failed to submit turn.");
      }
      const data = await response.json();
      const hostTurn: PodchatTurn = {
        id: `podchat-turn-${updatedTurns.length + 1}`,
        speaker: "host",
        text: `${data.hostText} ${data.followUpQuestion}`,
      };
      const finalTurns = [...updatedTurns, hostTurn];
      setTurns(finalTurns);
      const nextSubmittedCount = submittedUserTurns + 1;
      setSubmittedUserTurns(nextSubmittedCount);
      setStatus("user_turn");

      // Reset recording state after successful host response
      setLockedTranscript(null);
      setRecordingState("idle");

      playTts(`${data.hostText} ${data.followUpQuestion}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTurnError(msg || "An error occurred. Please try again.");
      setStatus("user_turn");
    }
  }

  function endSession() {
    const hasLearnerTurn = turns.some((t) => t.speaker === "learner");
    if (!hasLearnerTurn) {
      setTurnError("Complete at least one turn before evaluation.");
      return;
    }
    stopTimer();
    cleanupAudio();
    setStatus("complete");
    setPhase("evaluation");
    triggerEvaluation(turns);
  }

  if (phase === "setup") {
    if (articleContext) {
      return (
        <section className={card} data-testid="podchat-setup">
          <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Podchat Phase 1
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
              Start a Podchat
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)] font-medium">
              This Podchat will discuss your article speaking task.
            </p>
          </div>
          <div className="p-6 flex flex-col gap-6">
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 flex flex-col gap-4" data-testid="podchat-article-context-card">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">Article Title</span>
                <span className="text-sm font-medium text-[var(--brand-ink)] block mt-1">{articleContext.articleTitle}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">Article Brief</span>
                <p className="text-sm text-[var(--brand-ink-soft)] mt-1 whitespace-pre-wrap">{articleContext.articleBrief}</p>
              </div>
              {articleContext.speakingTaskTitle && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">Speaking Task</span>
                  <span className="text-sm font-medium text-[var(--brand-ink)] block mt-1">{articleContext.speakingTaskTitle}</span>
                </div>
              )}
              {articleContext.speakingTaskInstruction && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">Instruction</span>
                  <p className="text-sm text-[var(--brand-ink-soft)] mt-1 whitespace-pre-wrap">{articleContext.speakingTaskInstruction}</p>
                </div>
              )}
              {articleContext.targetStructure && articleContext.targetStructure.length > 0 && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">Target Structure</span>
                  <ul className="list-disc pl-5 mt-1 text-sm text-[var(--brand-ink-soft)] space-y-1">
                    {articleContext.targetStructure.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <fieldset>
              <legend className={labelClass}>Difficulty / Duration</legend>
              <div
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Podchat difficulty"
              >
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === option}
                    onClick={() => setDifficulty(option)}
                    className={
                      "rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] " +
                      (difficulty === option
                        ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/60 text-[var(--brand-teal-ink)]"
                        : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)]")
                    }
                  >
                    <span className="text-sm font-semibold">{option}</span>
                    <span
                      className="mt-1 block text-xs text-[var(--brand-ink-soft)]"
                      data-testid={`podchat-difficulty-duration-${option.toLowerCase()}`}
                    >
                      {DIFFICULTY_LABEL[option]}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={startPodchat}
                className={buttonPrimary}
              >
                Start a Podchat
              </button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className={card} data-testid="podchat-setup">
        <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            Podchat Phase 1
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
            Start a Podchat
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)]">
            Choose a topic and difficulty, then practice a timed conversation.
            Keep speaking until time runs out. This Phase 1 preview uses
            deterministic mock turns and does not use microphone capture, audio
            recording, or cloud storage.
          </p>
        </div>
        <div className="p-6">
          <fieldset>
            <legend className={labelClass}>Topic</legend>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Podchat topic"
            >
              {TOPICS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={topic === option}
                  onClick={() => setTopic(option)}
                  className={
                    "rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] " +
                    (topic === option
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/60 text-[var(--brand-teal-ink)]"
                      : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)]")
                  }
                >
                  <span className="text-sm font-semibold">{option}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className={labelClass}>Difficulty</legend>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Podchat difficulty"
            >
              {DIFFICULTIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === option}
                  onClick={() => setDifficulty(option)}
                  className={
                    "rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] " +
                    (difficulty === option
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/60 text-[var(--brand-teal-ink)]"
                      : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)]")
                  }
                >
                  <span className="text-sm font-semibold">{option}</span>
                  <span
                    className="mt-1 block text-xs text-[var(--brand-ink-soft)]"
                    data-testid={`podchat-difficulty-duration-${option.toLowerCase()}`}
                  >
                    {DIFFICULTY_LABEL[option]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={startPodchat}
              className={buttonPrimary}
            >
              Start a Podchat
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "evaluation") {
    return (
      <div className="flex flex-col gap-6" data-testid="podchat-evaluation">
        <section className={card}>
          <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Evaluation
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
              Podchat transcript and AI feedback
            </h2>
          </div>
          <div className="p-6">
            <h3 className={labelClass}>Full transcript</h3>
            <pre
              className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-sm leading-6 text-[var(--brand-ink)]"
              data-testid="podchat-full-transcript"
            >
              {fullTranscript || "No turns were submitted before ending."}
            </pre>
          </div>
        </section>

        {evalLoading && (
          <section className={`${card} p-6 flex flex-col items-center justify-center min-h-[200px]`} data-testid="podchat-evaluation-loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-teal)]"></div>
            <p className="mt-4 text-sm text-[var(--brand-ink-soft)]">Evaluating transcript...</p>
          </section>
        )}

        {evalError && (
          <section className={`${card} p-6`} data-testid="podchat-evaluation-error">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-800">Evaluation Error</h3>
              <p className="mt-2 text-sm text-red-700">{evalError}</p>
              <button
                type="button"
                onClick={() => triggerEvaluation(turns)}
                className={`${buttonPrimary} mt-4`}
              >
                Retry Evaluation
              </button>
            </div>
            <div className="mt-6 border-t border-[var(--brand-border)] pt-5">
              <button
                type="button"
                onClick={resetPodchat}
                className={buttonSecondary}
              >
                Start New Podchat
              </button>
            </div>
          </section>
        )}

        {evalData && (
          <section className={card} data-testid="podchat-evaluation-success">
            <div className="p-6 flex flex-col gap-6">
              <div>
                <h3 className={labelClass}>Summary</h3>
                <p className="text-sm leading-6 text-[var(--brand-ink-soft)]">{evalData.summary}</p>
              </div>

              {evalData.aspectFeedback && (
                <div>
                  <h3 className={labelClass}>Aspect Feedback</h3>
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
                </div>
              )}

              {evalData.corrections.length > 0 && (
                <div>
                  <h3 className={labelClass}>Corrections / Grammar Notes</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {evalData.corrections.map((c: PodchatCorrection, i: number) => (
                      <div key={i} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                        <p className="text-xs text-red-600 line-through">&quot;{c.original}&quot;</p>
                        <p className="mt-1 text-sm font-medium text-emerald-700">&quot;{c.improved}&quot;</p>
                        <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">{c.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evalData.betterSentences.length > 0 && (
                <div>
                  <h3 className={labelClass}>Better sentence examples</h3>
                  <ul className="mt-2 list-disc pl-5 text-sm text-[var(--brand-ink-soft)] space-y-2">
                    {evalData.betterSentences.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evalData.vocabularySuggestions.length > 0 && (
                <div>
                  <h3 className={labelClass}>Vocabulary suggestions</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {evalData.vocabularySuggestions.map((v: PodchatVocabularySuggestion, i: number) => (
                      <div key={i} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                        <p className="text-sm font-semibold text-[var(--brand-ink)]">
                          Instead of <span className="underline decoration-red-500">{v.originalOrBasic}</span>, try: <span className="text-[var(--brand-teal)]">{v.suggestion}</span>
                        </p>
                        <p className="mt-2 text-xs italic text-[var(--brand-ink-soft)]">Example: &quot;{v.example}&quot;</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evalData.recurringErrors.length > 0 && (
                <div>
                  <h3 className={labelClass}>Recurring Errors</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {evalData.recurringErrors.map((re: PodchatRecurringError, i: number) => (
                      <div key={i} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                        <p className="text-sm font-semibold text-[var(--brand-ink)]">{re.label}</p>
                        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">Evidence: <span className="italic">&quot;{re.evidence}&quot;</span></p>
                        <p className="mt-2 text-xs text-[var(--brand-teal-ink)]">Practice: {re.practiceFocus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className={labelClass}>Next practice focus</h3>
                <p className="text-sm leading-6 text-[var(--brand-ink-soft)]">{evalData.nextPracticeFocus}</p>
              </div>
            </div>
            <div className="border-t border-[var(--brand-border)] px-6 py-5">
              <button
                type="button"
                onClick={resetPodchat}
                className={buttonSecondary}
              >
                Start New Podchat
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="podchat-speaking">
      <section className={card}>
        <div className="flex flex-col gap-4 border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Speaking screen
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
              {topic} Podchat · {DIFFICULTY_LABEL[difficulty]}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span
              className={
                "rounded-full border px-3 py-1 " +
                (isTimeExpired
                  ? "border-red-300 bg-red-50 text-red-700"
                  : remainingSeconds <= 60
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink)]")
              }
              data-testid="podchat-time-left"
            >
              {isTimeExpired ? "Time's up" : `Time left: ${formatTime(remainingSeconds)}`}
            </span>
            <span
              className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1 text-[var(--brand-ink)]"
              data-testid="podchat-turns-completed"
            >
              Turns completed: {submittedUserTurns}
            </span>
            <span
              className="rounded-full border border-[var(--brand-teal)]/40 bg-[var(--brand-teal-soft)] px-3 py-1 text-[var(--brand-teal-ink)]"
              data-testid="podchat-status"
            >
              {statusLabel(status, isTtsSpeaking)}
            </span>
          </div>
        </div>
        <div className="p-6">
          <div
            aria-live="polite"
            className="flex flex-col gap-3"
            data-testid="podchat-rolling-transcript"
          >
            {rollingTurns.map((turn, index) => {
              const isCurrent = index === rollingTurns.length - 1;
              const isPrevious = index === rollingTurns.length - 2;
              return (
                <article
                  key={turn.id}
                  className={
                    "rounded-xl border p-4 transition-opacity " +
                    (isCurrent
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/50"
                      : isPrevious
                        ? "border-[var(--brand-border)] bg-[var(--brand-surface-2)]"
                        : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] opacity-45 blur-[1px]")
                  }
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
                    {speakerLabel(turn.speaker)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-ink)]">
                    {turn.text}
                  </p>
                </article>
              );
            })}

            {status === "submitting" && (
              <div className="flex items-center gap-2 p-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] animate-pulse" data-testid="podchat-loading-turn">
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                <span className="text-xs text-[var(--brand-muted)]">Host is thinking...</span>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
              Speaking Practice
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--brand-ink-soft)]">
              Record your spoken response. The transcript will be generated automatically.
            </p>

            {/* Recording State Views */}
            {recordingState === "recording" && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 animate-pulse" data-testid="podchat-recording-indicator">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium">Recording spoken response...</span>
              </div>
            )}

            {recordingState === "transcribing" && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-[var(--brand-muted)]" data-testid="podchat-transcribing-status">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--brand-teal)] border-t-transparent"></div>
                <span className="text-sm font-medium">Transcribing spoken answer...</span>
              </div>
            )}

            {recordingState === "ready" && lockedTranscript && (
              <div className="mt-4 flex flex-col gap-2">
                <div
                  className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 text-sm leading-6 text-[var(--brand-ink)] font-medium"
                  data-testid="podchat-locked-transcript"
                >
                  {lockedTranscript}
                </div>
                <p
                  className="text-xs text-[var(--brand-muted)] italic"
                  data-testid="podchat-transcript-disclaimer"
                >
                  Transcript is generated automatically and may contain recognition errors.
                </p>
              </div>
            )}

            {turnError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800" data-testid="podchat-turn-error">
                {turnError}
              </div>
            )}
            {ttsError && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800" data-testid="podchat-tts-error">
                {ttsError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {status === "user_turn" && recordingState === "idle" && !hasSubmitError && (
                <button
                  type="button"
                  onClick={startRecording}
                  className={buttonPrimary}
                  data-testid="podchat-start-recording"
                >
                  Start Recording
                </button>
              )}

              {status === "user_turn" && recordingState === "recording" && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
                  data-testid="podchat-stop-recording"
                >
                  Stop Recording
                </button>
              )}

              {status === "user_turn" && recordingState === "ready" && !hasSubmitError && (
                <>
                  <button
                    type="button"
                    onClick={submitTurn}
                    className={buttonPrimary}
                    data-testid="podchat-submit-turn"
                  >
                    Submit Turn
                  </button>
                  <button
                    type="button"
                    onClick={discardRecording}
                    className={buttonSecondary}
                    data-testid="podchat-re-record"
                  >
                    Re-record
                  </button>
                </>
              )}

              {hasSubmitError && (
                <button
                  type="button"
                  onClick={retryLastTurn}
                  disabled={status === "submitting"}
                  className={buttonPrimary}
                >
                  Retry Turn
                </button>
              )}

              {recordingState !== "transcribing" && (
                <button
                  type="button"
                  onClick={endSession}
                  disabled={status === "submitting"}
                  className={buttonSecondary}
                >
                  End Session
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
