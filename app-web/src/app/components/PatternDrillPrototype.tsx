import { useEffect, useMemo, useRef, useState } from "react";
import type { DrillSessionState, TurnResult } from "../lib/drill-session/types";
import type { TtsProvider, TtsVoiceProfile } from "../lib/tts/voiceProfiles";

type WeaknessDetails = {
  title: string;
  description: string;
  category: string;
  label: string;
  evidence?: string;
  practiceFocus?: string;
  failureCount: number;
  lastSeenAt: string;
  derivedConfidence: number;
};

type FetchState = {
  status: "loading" | "found" | "insufficient" | "empty" | "error";
  weakness?: WeaknessDetails;
  reason?: string;
};

type FlowState =
  | "idle"
  | "generating"
  | "phase0_brief"
  | "quick_check"
  | "phase1"
  | "phase2"
  | "phase3_intro"
  | "phase3"
  | "completing"
  | "summary"
  | "error";

type RecorderState = "ready" | "recording" | "transcribing" | "submitting" | "error_mic" | "error_stt" | "error_submit";

type QuickCheckTurnResult = {
  phase: "quick_check";
  result: "detected" | "not_detected_or_partial";
  entryPhase: 1 | 3;
};

type Phase2Result = {
  phase: 2;
  credit: "full" | "partial" | "none";
  missingSteps: string[];
  usedSteps: string[];
  shortFeedback: string;
};

type Phase3Result = {
  phase: 3;
  patternDetected: boolean;
  missingSteps: string[];
  usedSteps: string[];
  timedOut: boolean;
  shortFeedback: string;
  startLatencyMs?: number;
  pressurePassed?: boolean;
};

type DrillTurnResponse = {
  session: DrillSessionState;
  turnResult: QuickCheckTurnResult | TurnResult | Phase2Result | Phase3Result;
};

type DrillSummary = {
  phase1BaselineCompleteness: "complete" | "partial" | "missing";
  phase2Accuracy: number;
  fullCreditCount: number;
  partialCreditCount: number;
  noCreditCount: number;
  evaluatedAttemptCount: number;
  finalFullCreditStreak: number;
  mostMissedSteps: string[];
  simplifiedTopicUsed: boolean;
  improvementSignal: "strong" | "emerging" | "needs_more_repetition";
  nextSessionRecommendation: string;
  phase3PressureAccuracy: number | null;
  pressureFailRate: number | null;
  saved: boolean;
  reinforcementStatus?: string;
};

type PatternDrillPrototypeProps = {
  onExit: () => void;
  ttsProvider?: TtsProvider;
  ttsVoiceProfile?: TtsVoiceProfile;
  elevenLabsModelId?: string;
};

type PracticePhase = "quick_check" | 1 | 2 | 3;

const PHASE1_PROMPTS = [
  "Speak one sentence about online education from memory.",
  "Speak one sentence about renewable energy from memory.",
] as const;

const PHASE2_TOPICS = [
  "Explain how artificial intelligence impacts job roles.",
  "Discuss the pros and cons of remote work.",
] as const;

const SIMPLIFIED_TOPICS = [
  "Explain why eating healthy is good.",
  "Discuss why people like to travel.",
] as const;

const PRESSURE_ROUNDS = [
  { seconds: 10, topic: "Explain how artificial intelligence impacts job roles." },
  { seconds: 7, topic: "Discuss the pros and cons of remote work." },
  { seconds: 5, topic: "Explain why eating healthy is good." },
  { seconds: 3, topic: "Discuss why people like to travel." },
] as const;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/ogg")) return "audio/ogg";
  if (MediaRecorder.isTypeSupported("audio/wav")) return "audio/wav";
  return "audio/webm";
}

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // Best-effort microphone cleanup.
  }
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 0.8) return `High (${confidence.toFixed(2)})`;
  if (confidence >= 0.65) return `Medium (${confidence.toFixed(2)})`;
  return `Low (${confidence.toFixed(2)})`;
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? isoString : date.toLocaleDateString();
}

function getSafeErrorCopy(state: RecorderState | FlowState) {
  if (state === "error_mic") return "Microphone access is unavailable. Please allow microphone access and try again.";
  if (state === "error_stt") return "We could not capture that attempt. Please record again.";
  return "That step could not be completed. Please try again.";
}

function getPhaseLabel(flow: FlowState) {
  if (flow === "phase1") return "Phase 1 - Cold Recall";
  if (flow === "phase2") return "Phase 2 - Contrastive Repetition";
  if (flow === "phase3_intro" || flow === "phase3") return "Phase 3 - Pressure Test";
  if (flow === "quick_check") return "Preparing Your Spoken Drill";
  return "Drill Mode";
}

function getNow(): number {
  return Date.now();
}

export function PatternDrillPrototype({
  onExit,
  ttsProvider = "amazon-polly",
  ttsVoiceProfile = "british_female",
  elevenLabsModelId = "",
}: PatternDrillPrototypeProps) {
  const [weaknessState, setWeaknessState] = useState<FetchState>({ status: "loading" });
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [session, setSession] = useState<DrillSessionState | null>(null);
  const [recorderState, setRecorderState] = useState<RecorderState>("ready");
  const [lastResult, setLastResult] = useState<DrillTurnResponse["turnResult"] | null>(null);
  const [summary, setSummary] = useState<DrillSummary | null>(null);
  const [phase2TopicIndex, setPhase2TopicIndex] = useState(0);
  const [phase2AttemptNumber, setPhase2AttemptNumber] = useState<1 | 2 | 3>(1);
  const [phase2PreviousCredit, setPhase2PreviousCredit] = useState<"partial" | "none" | null>(null);
  const [phase2Simplified, setPhase2Simplified] = useState(false);
  const [phase3RoundIndex, setPhase3RoundIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [lastTtsText, setLastTtsText] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const roundStartTimeRef = useRef<number | null>(null);
  const latencyRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pendingPhaseRef = useRef<PracticePhase | null>(null);
  const pendingTopicRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);

  const brief = session?.briefContent ?? null;
  const phase1PromptIndex = Math.min(session?.phase1Results.length ?? 0, PHASE1_PROMPTS.length - 1);
  const currentPhase2Topic = phase2Simplified
    ? SIMPLIFIED_TOPICS[phase2TopicIndex]
    : PHASE2_TOPICS[phase2TopicIndex];
  const currentPressureRound = PRESSURE_ROUNDS[phase3RoundIndex];

  const canGenerate = weaknessState.status === "found" && !!weaknessState.weakness && flowState !== "generating";

  const disabledReason = useMemo(() => {
    if (weaknessState.status === "loading") return "Loading your weakness data...";
    if (weaknessState.status === "empty") return "No weakness data yet. Complete an evaluated Podchat session first.";
    if (weaknessState.status === "insufficient") return "More specific repeated feedback is needed before generating a brief.";
    if (weaknessState.status === "error") return "Weakness data could not be loaded.";
    return null;
  }, [weaknessState.status]);

  function resetRecorder() {
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecorderState("ready");
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

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchWeakness() {
      try {
        const res = await fetch("/api/pattern-drill/latest-weakness", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("weakness_fetch_failed");
        const data = await res.json();
        if (active) {
          setWeaknessState({
            status: data.status,
            weakness: data.weakness,
            reason: data.reason || data.error,
          });
        }
      } catch (err) {
        if (active && (err as Error)?.name !== "AbortError") {
          setWeaknessState({ status: "error" });
        }
      }
    }

    fetchWeakness();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopMediaStream(mediaStreamRef.current);
      cleanupAudio();
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, []);



  function buildTtsFeedbackText(
    spokenModelFragment: string,
    missingSteps: string[],
    credit: "full" | "partial" | "none"
  ): string {
    let missingElement = "";
    if (credit === "none") {
      missingElement = "Incorrect structure.";
    } else if (missingSteps && missingSteps.length > 0) {
      const cleanStep = missingSteps[0].replace(/[\[\]]/g, "").trim();
      missingElement = `Missing ${cleanStep}.`;
    } else {
      missingElement = "Try again.";
    }

    const words = missingElement.split(/\s+/);
    if (words.length > 6) {
      missingElement = words.slice(0, 6).join(" ");
    }

    return `${missingElement} ... ${spokenModelFragment} ... Repeat the phrase.`;
  }

  async function playTts(text: string) {
    cleanupAudio();
    setTtsError(null);
    setIsTtsSpeaking(true);

    if (ttsProvider === "elevenlabs" && !elevenLabsModelId) {
      setIsTtsSpeaking(false);
      setTtsError("Voice feedback unavailable. Try again or continue.");
      return;
    }

    try {
      const requestBody = ttsProvider === "elevenlabs"
        ? { text, ttsProvider, elevenLabsModelId }
        : { text, ttsProvider, voiceProfile: ttsVoiceProfile };

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
        setTtsError("Voice feedback unavailable. Try again or continue.");
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
      });

      await audio.play();
    } catch {
      setIsTtsSpeaking(false);
      setTtsError("Voice feedback unavailable. Try again or continue.");
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

  function handleExit() {
    const isSessionActive = session !== null && flowState !== "summary" && flowState !== "idle" && flowState !== "error";
    if (isSessionActive) {
      const confirmLeave = window.confirm("Leaving now will discard this drill session.");
      if (!confirmLeave) {
        return;
      }
    }
    cleanupAudio();
    stopMediaStream(mediaStreamRef.current);
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSession(null);
    setFlowState("idle");
    setSummary(null);
    setLastResult(null);
    resetRecorder();
    onExit();
  }

  function startPressureTimer(seconds: number) {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    setRemainingSeconds(seconds);
    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        const next = Math.max(0, (previous ?? seconds) - 1);
        if (next === 0 && intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return next;
      });
    }, 1000);
  }

  async function handleGenerateBrief() {
    if (!canGenerate) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFlowState("generating");
    setSummary(null);
    setLastResult(null);
    setSession(null);
    resetRecorder();

    try {
      const res = await fetch("/api/drill-session/start", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          level: "intermediate",
          mode: "structured_response",
          source: "latest_weakness",
        }),
      });

      if (!res.ok) {
        setFlowState("error");
        return;
      }

      const data = (await res.json()) as DrillSessionState;
      setSession(data);
      setFlowState("phase0_brief");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setFlowState("error");
    }
  }

  function handleStartDrill() {
    if (!session) return;
    setLastResult(null);
    setFlowState("quick_check");
    resetRecorder();
  }

  async function submitTurn(phase: PracticePhase, transcript: string, topic: string) {
    if (!session) return;

    setRecorderState("submitting");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const body: Record<string, unknown> = {
      session,
      phase,
      transcript,
    };

    if (phase === 1) {
      body.topic = topic;
      body.promptTopic = topic;
    }

    if (phase === 2) {
      body.topic = topic;
      body.promptTopic = topic;
      body.attemptNumber = phase2AttemptNumber;
      body.simplifiedTopicUsed = phase2Simplified;
      if (phase2PreviousCredit) body.previousCredit = phase2PreviousCredit;
    }

    if (phase === 3) {
      body.topic = topic;
      body.promptTopic = topic;
      body.roundSeconds = currentPressureRound.seconds;
      body.roundIndex = phase3RoundIndex;
      if (latencyRef.current !== null) {
        body.startLatencyMs = latencyRef.current;
      }
    }

    try {
      const res = await fetch("/api/drill-session/turn", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setRecorderState("error_submit");
        return;
      }

      const data = (await res.json()) as DrillTurnResponse;
      setSession(data.session);
      setLastResult(data.turnResult);
      setRecorderState("ready");

      if (phase === "quick_check") {
        const result = data.turnResult as QuickCheckTurnResult;
        if (result.entryPhase === 3) {
          setFlowState("phase3_intro");
        } else {
          setFlowState("phase1");
        }
        return;
      }

      if (phase === 1) {
        if (data.session.phase1Results.length >= 2) {
          setFlowState("phase2");
          setLastResult(null);
        }
        return;
      }

      if (phase === 2) {
        const result = data.turnResult as Phase2Result;
        if (result.credit === "full" || phase2AttemptNumber === 3) {
          setPhase2PreviousCredit(null);
        } else {
          setPhase2PreviousCredit(result.credit);
          setPhase2AttemptNumber((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : 3));
        }

        if (result.credit !== "full" && brief) {
          const ttsText = buildTtsFeedbackText(
            brief.responsePattern.spokenModelFragment,
            result.missingSteps,
            result.credit
          );
          setLastTtsText(ttsText);
          void playTts(ttsText);
        } else {
          setLastTtsText("");
        }
        return;
      }

      if (phase === 3 && data.session.phase3Results.length >= 4) {
        await completeSession(data.session);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setRecorderState("error_submit");
    }
  }

  async function transcribeAndSubmit(phase: PracticePhase, topic: string, audioBlob: Blob, blobMimeType: string) {
    setRecorderState("transcribing");

    try {
      const formData = new FormData();
      formData.append(
        "audio",
        audioBlob,
        `speech.${blobMimeType.split("/")[1]?.split(";")[0] || "webm"}`,
      );

      const res = await fetch("/api/podchat/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setRecorderState("error_stt");
        return;
      }

      const data = (await res.json()) as { transcript?: string };
      const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
      if (!transcript) {
        setRecorderState("error_stt");
        return;
      }

      await submitTurn(phase, transcript, topic);
    } catch {
      setRecorderState("error_stt");
    }
  }

  async function handleStartRecording(phase: PracticePhase, topic: string) {
    if (typeof MediaRecorder === "undefined") {
      setRecorderState("error_mic");
      return;
    }

    pendingPhaseRef.current = phase;
    pendingTopicRef.current = topic;
    audioChunksRef.current = [];
    setLastResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopMediaStream(mediaStreamRef.current);
        mediaStreamRef.current = null;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        const pendingPhase = pendingPhaseRef.current;
        const pendingTopic = pendingTopicRef.current;
        if (!pendingPhase || chunks.length === 0) {
          setRecorderState("error_stt");
          return;
        }
        const blobMimeType = recorder.mimeType || mimeType;
        const audioBlob = new Blob(chunks, { type: blobMimeType });
        void transcribeAndSubmit(pendingPhase, pendingTopic, audioBlob, blobMimeType);
      };

      recorder.start();
      setRecorderState("recording");
      if (phase === 3) {
        const latency = roundStartTimeRef.current ? getNow() - roundStartTimeRef.current : 0;
        latencyRef.current = Math.max(0, Math.min(60000, latency));
        startPressureTimer(currentPressureRound.seconds);
      }
    } catch {
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      setRecorderState("error_mic");
    }
  }

  function handleStopRecording() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        setRecorderState("error_stt");
      }
    }
  }

  function handleNextPhase2Step() {
    setLastResult(null);
    setRecorderState("ready");
    setPhase2AttemptNumber(1);
    setPhase2PreviousCredit(null);
    setPhase2Simplified(false);

    if (phase2TopicIndex + 1 < PHASE2_TOPICS.length) {
      setPhase2TopicIndex((prev) => prev + 1);
    } else {
      setFlowState("phase3_intro");
    }
  }

  function handleStartPressureRound() {
    setLastResult(null);
    setRemainingSeconds(currentPressureRound.seconds);
    setFlowState("phase3");
    resetRecorder();
    roundStartTimeRef.current = getNow();
    latencyRef.current = null;
  }

  function handleNextPressureRound() {
    setLastResult(null);
    setRecorderState("ready");
    setRemainingSeconds(null);
    if (phase3RoundIndex + 1 < PRESSURE_ROUNDS.length) {
      setPhase3RoundIndex((prev) => prev + 1);
      setFlowState("phase3_intro");
    } else if (session) {
      void completeSession(session);
    }
  }

  async function completeSession(finalSession: DrillSessionState) {
    setFlowState("completing");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/drill-session/complete", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(finalSession),
      });

      if (!res.ok) {
        setFlowState("error");
        return;
      }

      const data = (await res.json()) as DrillSummary & { session?: DrillSessionState };
      if (data.session) setSession(data.session);
      setSummary(data);
      setFlowState("summary");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setFlowState("error");
    }
  }

  function renderRecordControls(phase: PracticePhase, topic: string) {
    const isBusy = recorderState === "transcribing" || recorderState === "submitting";
    const errorCopy = recorderState.startsWith("error") ? getSafeErrorCopy(recorderState) : null;

    return (
      <div className="space-y-4" data-testid="spoken-recorder">
        {recorderState === "recording" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              Recording. Speak your answer now.
            </div>
            <button
              type="button"
              data-testid="stop-recording-btn"
              onClick={handleStopRecording}
              className="app-button px-5 py-2.5 text-sm"
            >
              Stop Recording
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="start-speaking-btn"
            onClick={() => void handleStartRecording(phase, topic)}
            disabled={isBusy}
            aria-disabled={isBusy}
            className={`app-button px-5 py-2.5 text-sm ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isBusy ? "Processing..." : "Start Speaking"}
          </button>
        )}

        {recorderState === "transcribing" && (
          <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="stt-safe-status">
            Capturing your spoken answer...
          </p>
        )}
        {recorderState === "submitting" && (
          <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="turn-submit-status">
            Checking the attempt...
          </p>
        )}
        {errorCopy && (
          <div
            role="alert"
            data-testid="spoken-safe-error"
            className="rounded-lg border border-[var(--brand-danger)] bg-[var(--brand-danger)] bg-opacity-10 p-3 text-sm text-[var(--brand-danger)]"
          >
            {errorCopy}
          </div>
        )}
      </div>
    );
  }

  function renderHeader(title = getPhaseLabel(flowState), subtitle?: string) {
    return (
      <div className="flex flex-col gap-3 border-b border-[var(--brand-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]" data-testid="phase-indicator">
            {title}
          </h3>
          {subtitle && <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">{subtitle}</p>}
        </div>
        <button type="button" data-testid="exit-drill-btn" onClick={handleExit} className="app-button-ghost px-3 py-1.5 text-sm">
          Exit to Podchat
        </button>
      </div>
    );
  }

  function renderWeaknessGate() {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-xs font-bold text-[var(--brand-teal-ink)]">
            1
          </span>
          <h4 className="font-semibold">Latest Weakness Check</h4>
        </div>

        <div className="ml-0 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3 sm:ml-8">
          {weaknessState.status === "loading" && (
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="weakness-loading">
              Checking your latest speaking weakness...
            </p>
          )}

          {weaknessState.status === "empty" && (
            <div data-testid="weakness-empty" className="space-y-2">
              <p className="text-sm font-medium">No speaking weakness data yet.</p>
              <p className="text-sm text-[var(--brand-ink-soft)]">
                Complete an evaluated Podchat session first.
              </p>
            </div>
          )}

          {weaknessState.status === "insufficient" && (
            <div data-testid="weakness-insufficient" className="space-y-2">
              <p className="text-sm font-medium">More evidence is needed.</p>
              <p className="text-sm text-[var(--brand-ink-soft)]">
                Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete more evaluated Podchat sessions so Fonetik can detect a repeated pattern.
              </p>
            </div>
          )}

          {weaknessState.status === "error" && (
            <div data-testid="weakness-error" role="alert" className="space-y-2">
              <p className="text-sm font-medium text-[var(--brand-danger)]">Could not load weakness data.</p>
              <p className="text-sm text-[var(--brand-ink-soft)]">Try again later.</p>
            </div>
          )}

          {weaknessState.status === "found" && weaknessState.weakness && (
            <div data-testid="weakness-found" className="space-y-3">
              <div>
                <p className="text-sm font-semibold">{weaknessState.weakness.title}</p>
                <p className="text-sm text-[var(--brand-ink-soft)]">{weaknessState.weakness.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-[var(--brand-muted)] sm:grid-cols-2">
                <span>Category: {weaknessState.weakness.category}</span>
                <span>Seen: {weaknessState.weakness.failureCount} times</span>
                <span>Confidence: {getConfidenceLabel(weaknessState.weakness.derivedConfidence)}</span>
                <span>Last seen: {formatDate(weaknessState.weakness.lastSeenAt)}</span>
              </div>
              {weaknessState.weakness.evidence && (
                <p className="text-xs text-[var(--brand-ink-soft)]">{weaknessState.weakness.evidence}</p>
              )}
              {weaknessState.weakness.practiceFocus && (
                <p className="text-xs text-[var(--brand-ink-soft)]">{weaknessState.weakness.practiceFocus}</p>
              )}
            </div>
          )}

          <div className="border-t border-[var(--brand-border)] pt-3">
            <button
              type="button"
              data-testid="generate-brief-btn"
              onClick={handleGenerateBrief}
              disabled={!canGenerate}
              aria-disabled={!canGenerate}
              className={`app-button px-4 py-2 text-sm ${!canGenerate ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {flowState === "generating" ? "Generating..." : "Generate Pattern Brief"}
            </button>
            {disabledReason && (
              <p className="mt-2 text-xs text-[var(--brand-muted)]" data-testid="generate-disabled-reason">
                {disabledReason}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderPhase0Brief() {
    if (!brief) return null;

    return (
      <section className="space-y-4" data-testid="brief-generated">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-xs font-bold text-[var(--brand-teal-ink)]">
            2
          </span>
          <h4 className="font-semibold">Pattern Brief</h4>
        </div>
        <div className="ml-0 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 space-y-5 sm:ml-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">Focus</p>
            <h5 className="mt-1 text-base font-semibold">{brief.title}</h5>
            <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">{brief.focus}</p>
          </div>

          <div data-testid="brief-quality-criteria">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">Quality Criteria</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {brief.qualityCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </div>

          <div data-testid="brief-response-pattern">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">Response Pattern</p>
            <p className="mt-1 text-sm font-medium">{brief.responsePattern.name}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {brief.responsePattern.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div data-testid="brief-mini-example">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">Mini Example</p>
            <div className="mt-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
              <p className="text-sm">{brief.miniExample}</p>
              <p className="mt-2 text-xs italic text-[var(--brand-muted)]" data-testid="mini-example-warning">
                Illustration only - do not memorize or copy.
              </p>
            </div>
          </div>

          <div data-testid="brief-common-mistakes">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">Common Mistakes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {brief.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            data-testid="start-drill-btn"
            onClick={handleStartDrill}
            className="app-button px-5 py-2.5 text-sm"
          >
            Start Drill
          </button>
        </div>
      </section>
    );
  }

  function renderQuickCheck() {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-5" data-testid="quick-check-section">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
            Internal Quick Check
          </p>
          <p className="text-sm text-[var(--brand-ink-soft)]">
            Speak one short answer from memory. The pattern brief is no longer visible.
          </p>
        </div>
        {renderRecordControls("quick_check", brief?.focus || "Pattern practice")}
      </div>
    );
  }

  function renderPhase1() {
    const prompt = PHASE1_PROMPTS[phase1PromptIndex];
    const completedCount = session?.phase1Results.length ?? 0;

    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-5">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)]">
            Baseline collection {completedCount + 1} of 2
          </span>
          <p className="text-base font-semibold" data-testid="drill-prompt-text">
            {prompt}
          </p>
          <p className="text-sm text-[var(--brand-ink-soft)]">
            This phase collects a baseline spoken response. Full pattern scoring starts in Phase 2.
          </p>
        </div>
        {lastResult && (
          <p className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-sm" data-testid="baseline-result">
            Baseline response recorded.
          </p>
        )}
        {renderRecordControls(1, prompt)}
      </div>
    );
  }

  function renderPhase2() {
    const result = lastResult && "credit" in lastResult ? (lastResult as Phase2Result) : null;
    const canAdvance = !!result && (result.credit === "full" || phase2AttemptNumber === 3);

    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-5">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)]">
            Topic {phase2TopicIndex + 1} of 2 - Attempt {phase2AttemptNumber} of 3
          </span>
          <p className="text-base font-semibold" data-testid="drill-prompt-text">
            {currentPhase2Topic}
          </p>
          <p className="text-sm text-[var(--brand-ink-soft)]">
            Speak from memory. The pattern reference stays hidden.
          </p>
        </div>

         {result && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4 space-y-2" data-testid="drill-feedback-box">
            <span className="inline-flex rounded-full bg-[var(--brand-teal-soft)] px-2 py-0.5 text-xs font-semibold uppercase text-[var(--brand-teal-ink)]">
              {result.credit === "full" ? "Full Credit" : result.credit === "partial" ? "Partial Credit" : "Keep Practicing"}
            </span>
            <p className="text-sm font-medium" data-testid="drill-feedback-text">
              {result.shortFeedback}
            </p>
            {result.missingSteps.length > 0 && (
              <p className="text-xs text-[var(--brand-muted)]" data-testid="drill-retry-prompt">
                Missing steps: {result.missingSteps.join(", ")}
              </p>
            )}
            {result.credit !== "full" && lastTtsText && (
              <div className="mt-3 flex flex-col gap-2 border-t border-[var(--brand-border)] pt-2" data-testid="audio-feedback-controls">
                {isTtsSpeaking && (
                  <p className="text-xs text-[var(--brand-teal-ink)] animate-pulse" data-testid="playing-feedback-status">
                    Playing feedback…
                  </p>
                )}
                {ttsError && (
                  <p className="text-xs text-[var(--brand-danger)]" data-testid="tts-error">
                    {ttsError}
                  </p>
                )}
                <button
                  type="button"
                  data-testid="repeat-audio-btn"
                  onClick={() => void playTts(lastTtsText)}
                  disabled={isTtsSpeaking}
                  className="app-button-ghost w-fit px-3 py-1.5 text-xs flex items-center gap-1"
                >
                  Repeat audio
                </button>
              </div>
            )}
          </div>
        )}

        {canAdvance ? (
          <button type="button" data-testid="drill-next-btn" onClick={handleNextPhase2Step} className="app-button px-5 py-2.5 text-sm">
            {phase2TopicIndex + 1 < PHASE2_TOPICS.length ? "Next Topic" : "Start Phase 3"}
          </button>
        ) : (
          renderRecordControls(2, currentPhase2Topic)
        )}
      </div>
    );
  }

  function renderPhase3Intro() {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-5">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)]">
            Round {phase3RoundIndex + 1} of {PRESSURE_ROUNDS.length}
          </span>
          <h4 className="text-base font-semibold">Time limit: {currentPressureRound.seconds} seconds</h4>
          <p className="text-sm text-[var(--brand-ink-soft)]">
            Speak after the timer starts. The timer is visual pressure; your spoken answer is still submitted only after recording stops.
          </p>
        </div>
        <button type="button" data-testid="start-pressure-round-btn" onClick={handleStartPressureRound} className="app-button px-5 py-2.5 text-sm">
          Start Round {phase3RoundIndex + 1}
        </button>
      </div>
    );
  }

  function renderPhase3() {
    const result = lastResult && "patternDetected" in lastResult ? (lastResult as Phase3Result) : null;
    const isFinalRound = phase3RoundIndex === PRESSURE_ROUNDS.length - 1;

    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)]">
              Round {phase3RoundIndex + 1} of {PRESSURE_ROUNDS.length}
            </span>
            <p className="text-base font-semibold" data-testid="drill-prompt-text">
              {currentPressureRound.topic}
            </p>
          </div>
          <div
            data-testid="pressure-countdown"
            className={`w-fit rounded px-3 py-1 text-lg font-bold ${
              (remainingSeconds ?? currentPressureRound.seconds) <= 3
                ? "bg-red-100 text-red-700"
                : "bg-[var(--brand-bg)] text-[var(--brand-teal-ink)]"
            }`}
          >
            {remainingSeconds ?? currentPressureRound.seconds}s
          </div>
        </div>

        {result && (
          <div
            data-testid="pressure-feedback-box"
            className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4 text-sm space-y-2"
          >
            <div className="flex gap-2">
              <span
                data-testid="pressure-pattern-status"
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                  result.patternDetected
                    ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)]"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {result.patternDetected ? "Pattern Detected" : "Pattern Missed"}
              </span>
              {result.pressurePassed !== undefined && (
                <span
                  data-testid="pressure-timing-status"
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                    result.pressurePassed
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {result.pressurePassed ? "Timing Pass" : "Timing Fail"}
                </span>
              )}
            </div>
            <p className="font-medium" data-testid="pressure-feedback-text">{result.shortFeedback}</p>
            {result.missingSteps.length > 0 && (
              <p className="mt-1 text-xs text-[var(--brand-muted)]">
                Missing steps: {result.missingSteps.join(", ")}
              </p>
            )}
          </div>
        )}

        {result ? (
          <button type="button" data-testid="pressure-next-btn" onClick={handleNextPressureRound} className="app-button px-5 py-2.5 text-sm">
            {isFinalRound ? "View Summary" : "Next Round"}
          </button>
        ) : (
          renderRecordControls(3, currentPressureRound.topic)
        )}
      </div>
    );
  }

  function renderSummary() {
    if (!summary) return null;

    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-5" data-testid="drill-session-summary">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-base font-semibold">Session Summary</h4>
          <span
            className="w-fit rounded-full bg-[var(--brand-teal-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand-teal-ink)]"
            data-testid="summary-save-status"
          >
            {summary.saved ? "Saved to your practice history." : "Summary available locally."}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
            <p className="text-xs uppercase text-[var(--brand-muted)]">Phase 1 Baseline</p>
            <p className="mt-1 text-2xl font-bold" data-testid="summary-baseline-completeness">
              {summary.phase1BaselineCompleteness}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
            <p className="text-xs uppercase text-[var(--brand-muted)]">Phase 2 Accuracy</p>
            <p className="mt-1 text-2xl font-bold" data-testid="summary-accuracy">{summary.phase2Accuracy}%</p>
          </div>
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
            <p className="text-xs uppercase text-[var(--brand-muted)]">Pressure Accuracy</p>
            <p className="mt-1 text-2xl font-bold" data-testid="summary-pressure-accuracy">
              {summary.phase3PressureAccuracy === null ? "not available yet" : `${summary.phase3PressureAccuracy}%`}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
            <p className="text-xs uppercase text-[var(--brand-muted)]">Pressure Fail Rate</p>
            <p className="mt-1 text-2xl font-bold" data-testid="summary-pressure-fail-rate">
              {summary.pressureFailRate === null ? "not available yet" : `${summary.pressureFailRate}%`}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
            <p className="text-xs uppercase text-[var(--brand-muted)]">Improvement Signal</p>
            <p className="mt-1 text-2xl font-bold" data-testid="summary-improvement-signal">{summary.improvementSignal}</p>
          </div>
        </div>

        <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="summary-recommendation">{summary.nextSessionRecommendation}</p>
        {summary.mostMissedSteps.length > 0 && (
          <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="summary-missed-steps">
            Focus next on: {summary.mostMissedSteps.join(", ")}
          </p>
        )}
        {summary.reinforcementStatus && (
          <p className="text-sm text-[var(--brand-ink-soft)]">
            Reinforcement: <span data-testid="summary-reinforcement-status">{summary.reinforcementStatus}</span>
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" data-testid="new-session-btn" onClick={handleGenerateBrief} className="app-button-primary px-5 py-2.5 text-sm">
            New Session
          </button>
          <button type="button" onClick={handleExit} className="app-button px-5 py-2.5 text-sm">
            Return to Podchat
          </button>
        </div>
      </div>
    );
  }

  function renderActiveFlow() {
    if (flowState === "quick_check") {
      return (
        <>
          {renderHeader("Preparing Your Spoken Drill", "Quick Check runs internally. The Pattern Brief has been removed from the page.")}
          {renderQuickCheck()}
        </>
      );
    }

    if (flowState === "phase1") {
      return (
        <>
          {renderHeader("Phase 1 - Cold Recall", "Speak from memory. This is baseline collection, not full pattern scoring.")}
          {renderPhase1()}
        </>
      );
    }

    if (flowState === "phase2") {
      return (
        <>
          {renderHeader("Phase 2 - Contrastive Repetition", "Repeat the idea until the core pattern is clear.")}
          {renderPhase2()}
        </>
      );
    }

    if (flowState === "phase3_intro") {
      return (
        <>
          {renderHeader("Phase 3 - Pressure Test", "Use the pattern under tighter timing.")}
          {renderPhase3Intro()}
        </>
      );
    }

    if (flowState === "phase3") {
      return (
        <>
          {renderHeader("Phase 3 - Pressure Test", "The timer is visible, but the pattern remains hidden.")}
          {renderPhase3()}
        </>
      );
    }

    if (flowState === "completing") {
      return (
        <>
          {renderHeader("Completing Drill Session")}
          <p className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 text-sm text-[var(--brand-ink-soft)]">
            Preparing your session summary...
          </p>
        </>
      );
    }

    if (flowState === "summary") {
      return (
        <>
          {renderHeader("Drill Session Complete")}
          {renderSummary()}
        </>
      );
    }

    if (flowState === "error") {
      return (
        <>
          {renderHeader("Drill Mode")}
          <div
            role="alert"
            data-testid="drill-flow-error"
            className="rounded-xl border border-[var(--brand-danger)] bg-[var(--brand-danger)] bg-opacity-10 p-6 text-sm text-[var(--brand-danger)]"
          >
            Drill Mode is unavailable right now. Please try again.
          </div>
        </>
      );
    }

    return null;
  }

  const activeFlowVisible = ["quick_check", "phase1", "phase2", "phase3_intro", "phase3", "completing", "summary", "error"].includes(flowState);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--brand-surface)] p-6 text-[var(--brand-ink)] lg:p-8">
      <div className="space-y-8">
        {!activeFlowVisible && renderHeader("Drill Mode", "Practice one speaking pattern through recall, repetition, and pressure.")}

        {!activeFlowVisible && renderWeaknessGate()}
        {flowState === "phase0_brief" && renderPhase0Brief()}

        {activeFlowVisible && renderActiveFlow()}
      </div>
    </div>
  );
}
