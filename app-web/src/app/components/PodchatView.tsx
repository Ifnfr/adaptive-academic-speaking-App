"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StoredSessionRecord } from "../lib/storage/types";

import {
  DIFFICULTY_DURATION,
  TOPICS,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  type PodchatTopic,
  type PodchatDifficulty,
} from "../lib/podchat";
import { getPodchatOpener } from "../lib/podchatOpener";

type PodchatPhase =
  | "setup"
  | "speaking"
  | "evaluation";
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

type ProviderErrorCategory =
  | "unauthorized"
  | "rate_limited"
  | "provider_unavailable"
  | "invalid_provider_response"
  | "missing_configuration"
  | "unknown";

type ProviderErrorResponse = {
  error?: string;
  providerError?: {
    category?: ProviderErrorCategory;
  };
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
  "Philosophy & Ethics": [
    "I believe ethical frameworks are essential for guiding new technologies.",
  ],
  "Science & Discovery": [
    "Scientific research is crucial for solving global challenges like climate change.",
  ],
  "Education & Learning": [
    "Education systems should focus more on critical thinking rather than memorization.",
  ],
  "Society & Culture": [
    "Cultural exchange helps build understanding and reduces prejudice between communities.",
  ],
  "Global Issues & Environment": [
    "International cooperation is the only way to effectively address environmental problems.",
  ],
  "Daily Life & Casual Conversation": [
    "I've been trying to balance my work and personal life more effectively recently.",
  ],
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

function providerErrorMessage(category: ProviderErrorCategory | undefined): string | null {
  if (category === "unauthorized") {
    return "AI provider is not authorized. Check the server-side API key.";
  }
  if (category === "rate_limited") {
    return "AI provider rate limit or quota was reached.";
  }
  if (category === "provider_unavailable") {
    return "AI provider is temporarily unavailable.";
  }
  if (category === "invalid_provider_response") {
    return "AI provider returned an invalid response.";
  }
  if (category === "missing_configuration") {
    return "AI provider is not configured.";
  }
  if (category === "unknown") {
    return "Provider request failed. Please try again later.";
  }
  return null;
}

function turnResponseErrorMessage(data: ProviderErrorResponse): string {
  return (
    providerErrorMessage(data.providerError?.category) ||
    data.error ||
    "Failed to submit turn."
  );
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

export type PodchatCommonplaceContextRef = {
  source: "commonplace";
  noteId: string;
};

type PodchatCommonplaceDiscussionContext = {
  source: "commonplace";
  noteId: string;
  shortcode: string;
  title?: string;
  sourceBook?: string;
  insight: string;
  tags: string[];
};

export type PodchatCommonplaceMapContextRef = {
  source: "commonplace-map";
  mapType: "sub" | "main";
  mapId: string;
};

type PodchatCommonplaceMapDiscussionContext = {
  source: "commonplace-map";
  mapType: "sub" | "main";
  mapId: string;
  mapTitle: string;
  counts: {
    nodes: number;
    edges: number;
    clusterNodes?: number;
    noteNodes?: number;
    truncatedNodes: boolean;
    truncatedEdges: boolean;
  };
  nodes: Array<{
    visualNodeId: string;
    nodeKind?: "note" | "cluster";
    noteId?: string;
    shortcode?: string;
    title?: string | null;
    sourceBook?: string;
    insightExcerpt?: string;
    tags?: string[];
    referencedSubMindMapId?: string;
    referencedSubMindMapTitle?: string;
  }>;
  edges: Array<{
    sourceVisualNodeId: string;
    targetVisualNodeId: string;
    edgeType: "solid" | "dashed";
    label: string | null;
  }>;
};

export type PodchatEvaluatedSessionXpContext = {
  sessionId: string;
  difficulty: PodchatDifficulty;
  hasArticleContext: boolean;
  hasCommonplaceContext: boolean;
};

export interface PodchatViewProps {
  sessionLevel?: string;
  sessionMode?: string;
  sessionProvider?: string;
  todayTarget?: string;
  onSessionHistoryRecord?: (record: StoredSessionRecord) => void;
  onEvaluatedSessionForXp?: (context: PodchatEvaluatedSessionXpContext) => void;
  articleContext?: PodchatArticleContext | null;
  onClearArticleContext?: () => void;
  commonplaceContext?: PodchatCommonplaceContextRef | null;
  onClearCommonplaceContext?: () => void;
  commonplaceMapContextRef?: PodchatCommonplaceMapContextRef | null;
  onClearCommonplaceMapContext?: () => void;
  ttsProvider?: "polly" | "elevenlabs";
  elevenLabsModelId?: "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "";
}

export function PodchatView({
  sessionLevel = "Intermediate",
  sessionMode = "Fluency Sprint",
  sessionProvider = "Claude",
  todayTarget = "",
  onSessionHistoryRecord,
  onEvaluatedSessionForXp,
  articleContext,
  onClearArticleContext,
  commonplaceContext,
  onClearCommonplaceContext,
  commonplaceMapContextRef,
  onClearCommonplaceMapContext,
  ttsProvider = "polly",
  elevenLabsModelId = "",
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
  const [commonplaceMapContext, setCommonplaceMapContext] =
    useState<PodchatCommonplaceMapDiscussionContext | null>(null);
  const [commonplaceMapContextLoading, setCommonplaceMapContextLoading] =
    useState(false);
  const [commonplaceMapContextError, setCommonplaceMapContextError] =
    useState<string | null>(null);
  const [commonplaceNoteContext, setCommonplaceNoteContext] =
    useState<PodchatCommonplaceDiscussionContext | null>(null);
  const [commonplaceNoteContextLoading, setCommonplaceNoteContextLoading] =
    useState(false);
  const [commonplaceNoteContextError, setCommonplaceNoteContextError] =
    useState<string | null>(null);

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

  function buildSessionCsv(record: StoredSessionRecord): string {
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    return [
      "Date,Level,Mode,Main_Weakness,Evidence,Next_Target",
      [
        record.date,
        record.level,
        record.mode,
        record.mainWeakness,
        record.evidence,
        record.retryTask,
      ]
        .map(escapeCsv)
        .join(","),
    ].join("\n");
  }

  function buildSessionHistoryRecord(
    finalTurns: PodchatTurn[],
    evaluation: PodchatEvaluateResponse,
  ): StoredSessionRecord {
    const now = new Date();
    const date = now.toISOString();
    const transcript = finalTurns
      .map((turn) => `${speakerLabel(turn.speaker)}: ${turn.text}`)
      .join("\n");
    const firstError = evaluation.recurringErrors[0] ?? null;
    const recordWithoutCsv: Omit<StoredSessionRecord, "csv"> = {
      id: `podchat-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      level: sessionLevel,
      mode: sessionMode,
      feedbackType: "Deep",
      sessionType: "Standard",
      provider: sessionProvider,
      todayTarget: todayTarget.trim() || `${topic} Podchat practice`,
      durationSeconds,
      transcript,
      mainWeakness:
        firstError?.label ||
        evaluation.nextPracticeFocus ||
        "Review the session feedback.",
      evidence: firstError?.evidence || evaluation.summary,
      betterPhrase: evaluation.betterSentences[0] ?? "",
      retryTask: firstError?.practiceFocus || evaluation.nextPracticeFocus,
      retryTranscript: "",
    };
    const record: StoredSessionRecord = {
      ...recordWithoutCsv,
      csv: "",
    };
    return {
      ...record,
      csv: buildSessionCsv(record),
    };
  }

  const buttonPrimary = "app-button app-button-primary";
  const buttonSecondary = "app-button app-button-secondary";
  const buttonDanger = "app-button app-button-danger";
  const labelClass = "app-label mb-2";
  const card = "app-panel brand-grid";
  const contextPanel = "app-panel-muted p-4 flex flex-col gap-4";
  const optionButtonBase =
    "min-h-20 rounded-xl border p-4 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]";
  const selectedOptionClass =
    "border-[var(--brand-accent-fill)] bg-[var(--brand-accent-fill)] text-[var(--brand-accent-fill-ink)]";
  const idleOptionClass =
    "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-surface)]";

  const commonplaceLabel =
    commonplaceNoteContext?.title?.trim() ||
    commonplaceNoteContext?.sourceBook?.trim() ||
    "your Commonplace note";

  const commonplaceOpener = commonplaceNoteContext
    ? `Today, we'll discuss your Commonplace note ${commonplaceNoteContext.shortcode} from ${commonplaceLabel}. Explain the idea in your own words.`
    : null;
  const commonplaceMapOpener = commonplaceMapContext
    ? commonplaceMapContext.mapType === "main"
      ? `Today, we'll discuss your Main Map "${commonplaceMapContext.mapTitle}". It has ${commonplaceMapContext.counts.nodes} visual node${commonplaceMapContext.counts.nodes !== 1 ? "s" : ""} and ${commonplaceMapContext.counts.edges} connection${commonplaceMapContext.counts.edges !== 1 ? "s" : ""}. Start by describing what the overall map represents.`
      : `Today, we'll discuss your Sub Mind Map "${commonplaceMapContext.mapTitle}". It includes ${commonplaceMapContext.counts.nodes} visual note${commonplaceMapContext.counts.nodes !== 1 ? "s" : ""} and ${commonplaceMapContext.counts.edges} connection${commonplaceMapContext.counts.edges !== 1 ? "s" : ""}. Start by explaining the strongest relationship you see.`
    : null;

  useEffect(() => {
    if (!commonplaceContext) {
      setTimeout(() => {
        setCommonplaceNoteContext(null);
        setCommonplaceNoteContextLoading(false);
        setCommonplaceNoteContextError(null);
      }, 0);
      return;
    }

    let isCurrent = true;
    const loadContext = async () => {
      setCommonplaceNoteContext(null);
      setCommonplaceNoteContextLoading(true);
      setCommonplaceNoteContextError(null);
      try {
        const params = new URLSearchParams({
          noteId: commonplaceContext.noteId,
        });
        const response = await fetch(`/api/commonplace/notes/context?${params}`, {
          method: "GET",
          credentials: "same-origin",
        });
        const data = (await response.json().catch(() => null)) as
          | {
              context?: PodchatCommonplaceDiscussionContext;
              error?: string;
            }
          | null;
        if (!isCurrent) return;
        if (response.ok && data?.context?.source === "commonplace") {
          setCommonplaceNoteContext(data.context);
          return;
        }
        setCommonplaceNoteContextError(
          data?.error === "auth_required"
            ? "Sign in again to discuss this note."
            : "Could not load this note discussion context.",
        );
      } catch {
        if (isCurrent) {
          setCommonplaceNoteContextError(
            "Could not load this note discussion context.",
          );
        }
      } finally {
        if (isCurrent) setCommonplaceNoteContextLoading(false);
      }
    };

    void loadContext();
    return () => {
      isCurrent = false;
    };
  }, [commonplaceContext]);

  useEffect(() => {
    if (!commonplaceMapContextRef) {
      setTimeout(() => {
        setCommonplaceMapContext(null);
        setCommonplaceMapContextLoading(false);
        setCommonplaceMapContextError(null);
      }, 0);
      return;
    }

    let isCurrent = true;
    const loadContext = async () => {
      setCommonplaceMapContext(null);
      setCommonplaceMapContextLoading(true);
      setCommonplaceMapContextError(null);
      try {
        const params = new URLSearchParams({
          mapId: commonplaceMapContextRef.mapId,
          mapType: commonplaceMapContextRef.mapType,
        });
        const response = await fetch(`/api/commonplace/maps/context?${params}`, {
          method: "GET",
          credentials: "same-origin",
        });
        const data = (await response.json().catch(() => null)) as
          | {
              context?: PodchatCommonplaceMapDiscussionContext;
              error?: string;
            }
          | null;
        if (!isCurrent) return;
        if (response.ok && data?.context?.source === "commonplace-map") {
          setCommonplaceMapContext(data.context);
          return;
        }
        setCommonplaceMapContextError(
          data?.error === "auth_required"
            ? "Sign in again to discuss this map."
            : "Could not load this map discussion context.",
        );
      } catch {
        if (isCurrent) {
          setCommonplaceMapContextError(
            "Could not load this map discussion context.",
          );
        }
      } finally {
        if (isCurrent) setCommonplaceMapContextLoading(false);
      }
    };

    void loadContext();
    return () => {
      isCurrent = false;
    };
  }, [commonplaceMapContextRef]);

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

    if (ttsProvider === "elevenlabs" && !elevenLabsModelId) {
      setIsTtsSpeaking(false);
      setTtsError("Voice unavailable. Continuing with text.");
      return;
    }

    try {
      const requestBody = ttsProvider === "elevenlabs"
        ? { text, ttsProvider, elevenLabsModelId }
        : { text, ttsProvider };

      const response = await fetch("/api/podchat/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
      text: commonplaceMapOpener ?? commonplaceOpener ?? getPodchatOpener(topic, difficulty),
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
    if (onClearCommonplaceContext) {
      onClearCommonplaceContext();
    }
    if (onClearCommonplaceMapContext) {
      onClearCommonplaceMapContext();
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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000);

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, `speech.${blobMimeType.split("/")[1] || "webm"}`);

          const response = await fetch("/api/podchat/stt", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

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
          clearTimeout(timeoutId);
          let msg = "";
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              msg = "Speech transcription timed out. Please try recording again.";
            } else {
              msg = err.message;
            }
          } else {
            msg = String(err);
          }
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
      const sessionRecord = buildSessionHistoryRecord(
        finalTurns,
        data as PodchatEvaluateResponse,
      );
      onSessionHistoryRecord?.(sessionRecord);
      onEvaluatedSessionForXp?.({
        sessionId: sessionRecord.id,
        difficulty,
        hasArticleContext: Boolean(articleContext),
        hasCommonplaceContext: Boolean(commonplaceNoteContext || commonplaceMapContext),
      });
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
      ...(commonplaceNoteContext ? { commonplaceContext: commonplaceNoteContext } : {}),
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
        const errJson = (await response.json().catch(() => ({}))) as ProviderErrorResponse;
        throw new Error(turnResponseErrorMessage(errJson));
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
        const errJson = (await response.json().catch(() => ({}))) as ProviderErrorResponse;
        throw new Error(turnResponseErrorMessage(errJson));
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
    if (commonplaceMapContextRef) {
      const canStartMapPodchat =
        Boolean(commonplaceMapContext) &&
        !commonplaceMapContextLoading &&
        !commonplaceMapContextError;
      return (
        <section className={card} data-testid="podchat-setup">
          <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Commonplace map
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
              Start a Podchat
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--brand-ink-soft)]">
              Discuss a saved Commonplace map without changing the canvas.
            </p>
          </div>
          <div className="p-6 flex flex-col gap-6">
            <div
              className={contextPanel}
              data-testid="podchat-commonplace-map-context-card"
            >
              {commonplaceMapContextLoading && (
                <p className="text-sm text-[var(--brand-ink-soft)]">
                  Loading map context…
                </p>
              )}
              {commonplaceMapContextError && (
                <p
                  role="alert"
                  className="app-message app-message-error"
                >
                  {commonplaceMapContextError}
                </p>
              )}
              {commonplaceMapContext && (
                <>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">
                      Source
                    </span>
                    <span className="text-sm font-semibold text-[var(--brand-teal)] block mt-1">
                      {commonplaceMapContext.mapType === "main" ? "Main Map" : "Sub Mind Map"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">
                      Map
                    </span>
                    <span className="text-sm font-medium text-[var(--brand-ink)] block mt-1">
                      {commonplaceMapContext.mapTitle}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="app-status app-status-info">
                      {commonplaceMapContext.counts.nodes} visual node{commonplaceMapContext.counts.nodes !== 1 ? "s" : ""}
                    </span>
                    <span className="app-status app-status-info">
                      {commonplaceMapContext.counts.edges} connection{commonplaceMapContext.counts.edges !== 1 ? "s" : ""}
                    </span>
                    {typeof commonplaceMapContext.counts.clusterNodes === "number" && commonplaceMapContext.mapType === "main" && (
                      <span className="app-status app-status-info">
                        {commonplaceMapContext.counts.clusterNodes} cluster{commonplaceMapContext.counts.clusterNodes !== 1 ? "s" : ""}
                      </span>
                    )}
                    {typeof commonplaceMapContext.counts.noteNodes === "number" && commonplaceMapContext.mapType === "main" && (
                      <span className="app-status app-status-info">
                        {commonplaceMapContext.counts.noteNodes} note{commonplaceMapContext.counts.noteNodes !== 1 ? "s" : ""}
                      </span>
                    )}
                    {(commonplaceMapContext.counts.truncatedNodes ||
                      commonplaceMapContext.counts.truncatedEdges) && (
                      <span className="app-status app-status-warning">
                        Bounded preview
                      </span>
                    )}
                  </div>
                  {commonplaceMapContext.nodes.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">
                        Preview
                      </span>
                      <ul className="mt-2 grid gap-2">
                        {commonplaceMapContext.nodes.slice(0, 3).map((node) => (
                          <li
                            key={node.visualNodeId}
                            className="app-panel-muted px-3 py-2 text-sm text-[var(--brand-ink-soft)]"
                          >
                            {node.nodeKind === "cluster" ? (
                              <span className="font-semibold text-[var(--brand-ink)]">
                                📁 {node.referencedSubMindMapTitle || "Sub Mind Map"}
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold text-[var(--brand-ink)]">
                                  {node.title || node.shortcode}
                                </span>
                                <span className="ml-2 text-xs text-[var(--brand-muted)]">
                                  {node.shortcode}
                                </span>
                                <p className="mt-1 line-clamp-2">
                                  {node.insightExcerpt}
                                </p>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {commonplaceMapOpener && (
              <p className="app-message app-message-info">
                {commonplaceMapOpener}
              </p>
            )}

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
                      optionButtonBase + " " +
                      (difficulty === option
                        ? selectedOptionClass
                        : idleOptionClass)
                    }
                  >
                    <span className="text-sm font-semibold">{option}</span>
                    <span
                      className={
                        "mt-1 block text-xs " +
                        (difficulty === option
                          ? "text-[var(--brand-accent-fill-ink)]"
                          : "text-[var(--brand-ink-soft)]")
                      }
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
                disabled={!canStartMapPodchat}
              >
                Start a Podchat
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (commonplaceContext) {
      const canStartNotePodchat =
        Boolean(commonplaceNoteContext) &&
        !commonplaceNoteContextLoading &&
        !commonplaceNoteContextError;
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
              This Podchat will discuss your Commonplace note.
            </p>
          </div>
          <div className="p-6 flex flex-col gap-6">
            <div
              className={contextPanel}
              data-testid="podchat-commonplace-context-card"
            >
              {commonplaceNoteContextLoading && (
                <p className="text-sm text-[var(--brand-ink-soft)]">
                  Loading note context...
                </p>
              )}
              {commonplaceNoteContextError && (
                <p
                  role="alert"
                  className="app-message app-message-error"
                >
                  {commonplaceNoteContextError}
                </p>
              )}
              {commonplaceNoteContext && (
                <>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">
                      Commonplace context
                    </span>
                    <span className="text-sm font-semibold text-[var(--brand-teal)] block mt-1">
                      {commonplaceNoteContext.shortcode}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">
                      Source
                    </span>
                    <span className="text-sm font-medium text-[var(--brand-ink)] block mt-1">
                      {commonplaceLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">
                      Insight
                    </span>
                    <p className="text-sm text-[var(--brand-ink-soft)] mt-1 whitespace-pre-wrap">
                      {commonplaceNoteContext.insight}
                    </p>
                  </div>
                  {commonplaceNoteContext.tags.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] block">
                        Tags
                      </span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {commonplaceNoteContext.tags.map((tag) => (
                          <span
                            key={tag}
                            className="app-status app-status-info"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {commonplaceOpener && (
              <p className="app-message app-message-info">
                {commonplaceOpener}
              </p>
            )}

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
                      optionButtonBase + " " +
                      (difficulty === option
                        ? selectedOptionClass
                        : idleOptionClass)
                    }
                  >
                    <span className="text-sm font-semibold">{option}</span>
                    <span
                      className={
                        "mt-1 block text-xs " +
                        (difficulty === option
                          ? "text-[var(--brand-accent-fill-ink)]"
                          : "text-[var(--brand-ink-soft)]")
                      }
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
                disabled={!canStartNotePodchat}
              >
                Start a Podchat
              </button>
            </div>
          </div>
        </section>
      );
    }

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
            <div className={contextPanel} data-testid="podchat-article-context-card">
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
                      optionButtonBase + " " +
                      (difficulty === option
                        ? selectedOptionClass
                        : idleOptionClass)
                    }
                  >
                    <span className="text-sm font-semibold">{option}</span>
                    <span
                      className={
                        "mt-1 block text-xs " +
                        (difficulty === option
                          ? "text-[var(--brand-accent-fill-ink)]"
                          : "text-[var(--brand-ink-soft)]")
                      }
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
            Keep speaking until time runs out. Your spoken response is
            transcribed for the conversation and evaluation flow.
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
                    optionButtonBase + " " +
                    (topic === option
                      ? selectedOptionClass
                      : idleOptionClass)
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
                    optionButtonBase + " " +
                    (difficulty === option
                      ? selectedOptionClass
                      : idleOptionClass)
                  }
                >
                  <span className="text-sm font-semibold">{option}</span>
                  <span
                    className={
                      "mt-1 block text-xs " +
                      (difficulty === option
                        ? "text-[var(--brand-accent-fill-ink)]"
                        : "text-[var(--brand-ink-soft)]")
                    }
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
            <div className="app-message app-message-error">
              <h3 className="text-sm font-semibold">Evaluation Error</h3>
              <p className="mt-2 text-sm">{evalError}</p>
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
                      <div key={i} className="app-panel-muted p-4">
                        <p className="text-xs text-[var(--brand-coral)] line-through">&quot;{c.original}&quot;</p>
                        <p className="mt-1 text-sm font-medium text-[var(--brand-success-ink)]">&quot;{c.improved}&quot;</p>
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
                      <div key={i} className="app-panel-muted p-4">
                        <p className="text-sm font-semibold text-[var(--brand-ink)]">
                          Instead of <span className="underline decoration-[var(--brand-coral)]">{v.originalOrBasic}</span>, try: <span className="text-[var(--brand-teal)]">{v.suggestion}</span>
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
                      <div key={i} className="app-panel-muted p-4">
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
                "app-status " +
                (isTimeExpired
                  ? "app-status-error"
                  : remainingSeconds <= 60
                    ? "app-status-warning"
                    : "app-status-info")
              }
              data-testid="podchat-time-left"
            >
              {isTimeExpired ? "Time's up" : `Time left: ${formatTime(remainingSeconds)}`}
            </span>
            <span
              className="app-status app-status-info"
              data-testid="podchat-turns-completed"
            >
              Turns completed: {submittedUserTurns}
            </span>
            <span
              className="app-status app-status-info"
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
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]"
                      : isPrevious
                        ? "border-[var(--brand-border)] bg-[var(--brand-surface-2)]"
                        : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] opacity-70")
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
              <div className="app-message app-message-info flex items-center gap-2" data-testid="podchat-loading-turn">
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)]"></div>
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] opacity-70"></div>
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] opacity-40"></div>
                <span className="text-xs text-[var(--brand-muted)]">Host is thinking...</span>
              </div>
            )}
          </div>

          <div className="app-panel-muted mt-6 p-4">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
              Speaking Practice
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--brand-ink-soft)]">
              Record your spoken response. The transcript will be generated automatically.
            </p>

            {/* Recording State Views */}
            {recordingState === "recording" && (
              <div className="app-message app-message-error mt-4 flex items-center gap-3" data-testid="podchat-recording-indicator">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--brand-coral)] opacity-30"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--brand-coral)]"></span>
                </span>
                <span className="text-sm font-medium">Recording spoken response...</span>
              </div>
            )}

            {recordingState === "transcribing" && (
              <div className="app-message app-message-info mt-4 flex items-center gap-3" data-testid="podchat-transcribing-status">
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
              <div className="app-message app-message-error mt-4 text-xs" data-testid="podchat-turn-error">
                {turnError}
              </div>
            )}
            {ttsError && (
              <div className="app-message app-message-warning mt-4 text-xs" data-testid="podchat-tts-error">
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
                  className={buttonDanger}
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
