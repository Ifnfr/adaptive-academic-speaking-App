import { useState, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type PatternBriefResponse = {
  briefId: string;
  title: string;
  focus: string;
  qualityCriteria: string[];
  responsePattern: { name: string; steps: string[] };
  miniExample: string;
  commonMistakes: string[];
  drillEntryConfig: unknown; // kept in state for future handoff, never rendered
};

type BriefState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "generated"; brief: PatternBriefResponse }
  | { status: "error" };

type QuickCheckStatus =
  | "idle"                   // brief generated, check not started
  | "recording_ready"        // check panel open, mic not yet active
  | "recording"              // MediaRecorder active
  | "transcribing"           // audio uploaded, waiting for STT response
  | "transcript_ready"       // transcript returned, user can check or re-record
  | "checking"               // transcript submitted to quick-check API
  | "detected"               // result: pattern detected
  | "not_detected_or_partial"
  | "skipped"
  | "error_mic"              // getUserMedia failed or MediaRecorder unavailable
  | "error_stt"              // STT API returned error
  | "error_check";           // quick-check API returned error

type QuickCheckState = {
  status: QuickCheckStatus;
  entryPhase: 1 | 3;
  transcript: string; // returned from STT, editable as fallback
};

type DrillModeContext = {
  briefId: string;
  targetPattern: string;
  targetSteps: string[];
  commonMistakes: string[];
  entryPhase: 1 | 3;
  quickCheck:
    | { status: "detected"; transcript: string }
    | { status: "not_detected_or_partial"; transcript: string }
    | { status: "skipped" };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // ignore
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

type PatternDrillPrototypeProps = {
  onExit: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PatternDrillPrototype({ onExit }: PatternDrillPrototypeProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [briefState, setBriefState] = useState<BriefState>({ status: "idle" });
  const [quickCheckState, setQuickCheckState] = useState<QuickCheckState>({
    status: "idle",
    entryPhase: 1,
    transcript: "",
  });
  // Stored for future Drill handoff — never rendered in DOM
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_drillContext, setDrillContext] = useState<DrillModeContext | null>(null);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Request abort refs
  const briefAbortRef = useRef<AbortController | null>(null);
  const checkAbortRef = useRef<AbortController | null>(null);

  // ── Fetch weakness on mount ──────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchWeakness() {
      try {
        const res = await fetch("/api/pattern-drill/latest-weakness", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        if (active) {
          setState({
            status: data.status,
            weakness: data.weakness,
            reason: data.reason || data.error,
          });
        }
      } catch (err) {
        if (active && (err as Error)?.name !== "AbortError") {
          setState({ status: "error" });
        }
      }
    }

    fetchWeakness();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      briefAbortRef.current?.abort();
      checkAbortRef.current?.abort();
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
    };
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────

  const canGenerate =
    state.status === "found" && !!state.weakness && briefState.status !== "generating";

  const isCheckActive = quickCheckState.status !== "idle";

  const isCheckTerminal =
    quickCheckState.status === "detected" ||
    quickCheckState.status === "not_detected_or_partial" ||
    quickCheckState.status === "skipped";

  const displayEntryPhase = isCheckTerminal ? quickCheckState.entryPhase : null;

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleGenerateBrief() {
    if (!canGenerate) return;

    briefAbortRef.current?.abort();
    const controller = new AbortController();
    briefAbortRef.current = controller;

    setBriefState({ status: "generating" });
    setQuickCheckState({ status: "idle", entryPhase: 1, transcript: "" });
    setDrillContext(null);
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;

    try {
      const res = await fetch("/api/pattern-brief/generate", {
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
        setBriefState({ status: "error" });
        return;
      }

      const data = (await res.json()) as PatternBriefResponse;
      setBriefState({ status: "generated", brief: data });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setBriefState({ status: "error" });
    }
  }

  function handleStartCheck() {
    setQuickCheckState({ status: "recording_ready", entryPhase: 1, transcript: "" });
  }

  function handleSkip() {
    if (briefState.status !== "generated") return;
    const brief = briefState.brief;
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
    setQuickCheckState({ status: "skipped", entryPhase: 1, transcript: "" });
    setDrillContext({
      briefId: brief.briefId,
      targetPattern: brief.responsePattern.name,
      targetSteps: brief.responsePattern.steps,
      commonMistakes: brief.commonMistakes,
      entryPhase: 1,
      quickCheck: { status: "skipped" },
    });
  }

  async function handleStartRecording() {
    if (typeof MediaRecorder === "undefined") {
      setQuickCheckState((prev) => ({
        ...prev,
        status: "error_mic",
        transcript: "",
      }));
      return;
    }

    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop tracks immediately
        stopMediaStream(mediaStreamRef.current);
        mediaStreamRef.current = null;

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setQuickCheckState((prev) => ({ ...prev, status: "error_stt", transcript: "" }));
          return;
        }

        const blobMimeType = recorder.mimeType || mimeType;
        const audioBlob = new Blob(chunks, { type: blobMimeType });
        audioChunksRef.current = [];

        setQuickCheckState((prev) => ({ ...prev, status: "transcribing" }));

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
            setQuickCheckState((prev) => ({ ...prev, status: "error_stt", transcript: "" }));
            return;
          }

          const data = (await res.json()) as { transcript?: string };
          if (data.transcript && typeof data.transcript === "string") {
            setQuickCheckState((prev) => ({
              ...prev,
              status: "transcript_ready",
              transcript: data.transcript as string,
            }));
          } else {
            setQuickCheckState((prev) => ({ ...prev, status: "error_stt", transcript: "" }));
          }
        } catch {
          setQuickCheckState((prev) => ({ ...prev, status: "error_stt", transcript: "" }));
        }
      };

      recorder.start();
      setQuickCheckState((prev) => ({ ...prev, status: "recording" }));
    } catch {
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      setQuickCheckState((prev) => ({ ...prev, status: "error_mic", transcript: "" }));
    }
  }

  function handleStopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
  }

  function handleRecordAgain() {
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
    setQuickCheckState((prev) => ({
      ...prev,
      status: "recording_ready",
      transcript: "",
    }));
  }

  async function handleSubmitCheck() {
    if (briefState.status !== "generated") return;
    const trimmedTranscript = quickCheckState.transcript.trim();
    if (!trimmedTranscript) return;

    checkAbortRef.current?.abort();
    const controller = new AbortController();
    checkAbortRef.current = controller;

    const brief = briefState.brief;
    setQuickCheckState((prev) => ({ ...prev, status: "checking" }));

    try {
      const res = await fetch("/api/pattern-drill/quick-check", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          briefId: brief.briefId,
          responsePattern: {
            name: brief.responsePattern.name,
            steps: brief.responsePattern.steps,
          },
          commonMistakes: brief.commonMistakes,
          transcript: trimmedTranscript,
        }),
      });

      if (!res.ok) {
        setQuickCheckState((prev) => ({ ...prev, status: "error_check" }));
        return;
      }

      const data = (await res.json()) as {
        result: "detected" | "not_detected_or_partial";
        entryPhase: 1 | 3;
      };

      const newStatus: QuickCheckStatus = data.result;
      const entryPhase: 1 | 3 = data.entryPhase;

      setQuickCheckState({ status: newStatus, entryPhase, transcript: trimmedTranscript });
      setDrillContext({
        briefId: brief.briefId,
        targetPattern: brief.responsePattern.name,
        targetSteps: brief.responsePattern.steps,
        commonMistakes: brief.commonMistakes,
        entryPhase,
        quickCheck:
          data.result === "detected"
            ? { status: "detected", transcript: trimmedTranscript }
            : { status: "not_detected_or_partial", transcript: trimmedTranscript },
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setQuickCheckState((prev) => ({ ...prev, status: "error_check" }));
    }
  }

  function handleRetryCheck() {
    setQuickCheckState({ status: "recording_ready", entryPhase: 1, transcript: "" });
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return `High (${confidence.toFixed(2)})`;
    if (confidence >= 0.65) return `Medium (${confidence.toFixed(2)})`;
    return `Low (${confidence.toFixed(2)})`;
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return isNaN(date.getTime()) ? isoString : date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  function getDisabledReason(): string | null {
    if (state.status === "loading") return "Loading your weakness data…";
    if (state.status === "empty")
      return "No weakness data yet. Complete an evaluated Podchat session first.";
    if (state.status === "insufficient")
      return "More specific repeated feedback is needed before generating a brief.";
    if (state.status === "error") return "Weakness data could not be loaded.";
    return null;
  }

  const disabledReason = getDisabledReason();

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">Pattern Drill</h3>
          <p className="text-sm text-[var(--brand-ink-soft)] mt-1">
            Compact Prototype Mode. (No backend features active.)
          </p>
        </div>
        <button type="button" onClick={onExit} className="app-button-ghost px-3 py-1.5 text-sm">
          Exit to Podchat
        </button>
      </div>

      {/* Section 1 — Weakness Check & Brief */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-xs font-bold text-[var(--brand-teal-ink)]">
            1
          </span>
          <h4 className="font-semibold">Latest Weakness Check &amp; Brief</h4>
        </div>

        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3">
          {/* Loading */}
          {state.status === "loading" && (
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="weakness-loading">
              Checking your latest speaking weakness...
            </p>
          )}
          {/* Error */}
          {state.status === "error" && (
            <p className="text-sm text-[var(--brand-danger)]" data-testid="weakness-error">
              Could not load weakness data. Try again later.
            </p>
          )}
          {/* Empty */}
          {state.status === "empty" && (
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="weakness-empty">
              No speaking weakness data yet. Complete an evaluated Podchat session first.
            </p>
          )}
          {/* Insufficient */}
          {state.status === "insufficient" && (
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="weakness-insufficient">
              Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete
              more evaluated Podchat sessions so Fonetik can detect a repeated pattern.
            </p>
          )}

          {/* Found */}
          {state.status === "found" && state.weakness && (
            <div className="space-y-4" data-testid="weakness-found">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--brand-teal-ink)] font-semibold">
                  Recommended Weakness
                </p>
                <h5 className="text-base font-semibold mt-1">{state.weakness.description}</h5>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-t border-[var(--brand-border)] pt-3">
                <div>
                  <span className="text-[var(--brand-muted)] block">Category</span>
                  <span className="font-medium">{state.weakness.category}</span>
                </div>
                <div>
                  <span className="text-[var(--brand-muted)] block">Occurrences</span>
                  <span className="font-medium">{state.weakness.failureCount} times</span>
                </div>
                <div>
                  <span className="text-[var(--brand-muted)] block">Last Seen</span>
                  <span className="font-medium">{formatDate(state.weakness.lastSeenAt)}</span>
                </div>
                <div>
                  <span className="text-[var(--brand-muted)] block">Confidence</span>
                  <span className="font-medium">
                    {getConfidenceLabel(state.weakness.derivedConfidence)}
                  </span>
                </div>
              </div>
              {state.weakness.evidence && (
                <div className="rounded bg-[var(--brand-bg)] p-3 border border-[var(--brand-border)]">
                  <p className="text-xs font-mono text-[var(--brand-muted)] mb-1">
                    Observed Evidence
                  </p>
                  <p className="text-sm">{state.weakness.evidence}</p>
                </div>
              )}
              {state.weakness.practiceFocus && (
                <div className="rounded bg-[var(--brand-bg)] p-3 border border-[var(--brand-border)]">
                  <p className="text-xs font-mono text-[var(--brand-muted)] mb-1">
                    Practice Focus
                  </p>
                  <p className="text-sm">{state.weakness.practiceFocus}</p>
                </div>
              )}
            </div>
          )}

          {/* Generate button */}
          <div className="pt-2" role="region" aria-live="polite">
            <button
              type="button"
              data-testid="generate-brief-btn"
              onClick={handleGenerateBrief}
              disabled={!canGenerate}
              aria-disabled={!canGenerate}
              className={`app-button px-4 py-2 text-sm ${!canGenerate ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {briefState.status === "generating"
                ? "Building your pattern brief…"
                : "Generate Pattern Brief"}
            </button>
            {!canGenerate && disabledReason && (
              <p
                className="text-xs text-[var(--brand-muted)] mt-2"
                data-testid="generate-disabled-reason"
              >
                {disabledReason}
              </p>
            )}
            {briefState.status === "error" && (
              <p className="text-sm text-[var(--brand-danger)] mt-2" data-testid="brief-error">
                Unable to generate. Please try again.
              </p>
            )}
          </div>

          {/* Generated Brief */}
          {briefState.status === "generated" && (
            <div
              className="space-y-5 border-t border-[var(--brand-border)] pt-5 mt-4"
              data-testid="brief-generated"
              aria-label="Generated Pattern Brief"
            >
              <div>
                <h5 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-teal-ink)] mb-1">
                  {briefState.brief.title}
                </h5>
                <p className="text-xs text-[var(--brand-muted)]">{briefState.brief.focus}</p>
              </div>

              {/* Quality Criteria — always visible */}
              <div data-testid="brief-quality-criteria">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                  Quality Criteria
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {briefState.brief.qualityCriteria.map((c, i) => (
                    <li key={i} className="text-sm">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Response Pattern — hidden once check starts */}
              {!isCheckActive ? (
                <div data-testid="brief-response-pattern">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                    Response Pattern
                  </p>
                  <p className="text-sm font-medium mb-2">
                    {briefState.brief.responsePattern.name}
                  </p>
                  <ol className="list-decimal pl-5 space-y-1">
                    {briefState.brief.responsePattern.steps.map((step, i) => (
                      <li key={i} className="text-sm font-mono text-[var(--brand-teal-ink)]">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div data-testid="brief-pattern-hidden">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-1">
                    Response Pattern
                  </p>
                  <p className="text-sm text-[var(--brand-muted)] italic">
                    Pattern hidden for the check.
                  </p>
                </div>
              )}

              {/* Mini Example — hidden once check starts */}
              {!isCheckActive && (
                <div data-testid="brief-mini-example">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                    Mini Example
                  </p>
                  <div className="rounded bg-[var(--brand-bg)] p-3 border border-[var(--brand-border)] space-y-2">
                    <p className="text-sm">{briefState.brief.miniExample}</p>
                    <p
                      className="text-xs italic text-[var(--brand-muted)]"
                      data-testid="mini-example-warning"
                    >
                      Illustration only — do not memorize or copy.
                    </p>
                  </div>
                </div>
              )}

              {/* Common Mistakes — always visible */}
              <div data-testid="brief-common-mistakes">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                  Common Mistakes to Avoid
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {briefState.brief.commonMistakes.map((m, i) => (
                    <li key={i} className="text-sm">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Quick Spoken Check ─────────────────────────────────── */}
              <div
                className="border-t border-[var(--brand-border)] pt-4"
                data-testid="quick-check-section"
                role="region"
                aria-live="polite"
                aria-label="Quick Spoken Check"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-3">
                  Quick Spoken Check
                </p>

                {/* idle */}
                {quickCheckState.status === "idle" && (
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--brand-ink-soft)]">
                      Try saying the pattern once before starting your drill session.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="start-quick-check-btn"
                        onClick={handleStartCheck}
                        className="app-button px-4 py-2 text-sm"
                      >
                        Start Quick Check
                      </button>
                      <button
                        type="button"
                        data-testid="skip-check-btn-idle"
                        onClick={handleSkip}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Skip Quick Check
                      </button>
                    </div>
                  </div>
                )}

                {/* recording_ready */}
                {quickCheckState.status === "recording_ready" && (
                  <div className="space-y-3" data-testid="quick-check-recording-ready">
                    <p className="text-sm text-[var(--brand-ink-soft)]">
                      Speak one sentence using the pattern. Click{" "}
                      <strong>Start Speaking</strong> when ready.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="start-speaking-btn"
                        onClick={handleStartRecording}
                        className="app-button px-4 py-2 text-sm"
                      >
                        Start Speaking
                      </button>
                      <button
                        type="button"
                        data-testid="skip-check-btn"
                        onClick={handleSkip}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Skip Quick Check
                      </button>
                    </div>
                  </div>
                )}

                {/* recording */}
                {quickCheckState.status === "recording" && (
                  <div className="space-y-3" data-testid="quick-check-recording">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                      <p className="text-sm font-medium text-[var(--brand-ink)]">
                        Recording… Speak your sentence now.
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="stop-recording-btn"
                      onClick={handleStopRecording}
                      className="app-button px-4 py-2 text-sm"
                    >
                      Stop Recording
                    </button>
                  </div>
                )}

                {/* transcribing */}
                {quickCheckState.status === "transcribing" && (
                  <div data-testid="quick-check-transcribing">
                    <p className="text-sm text-[var(--brand-ink-soft)]">Transcribing…</p>
                  </div>
                )}

                {/* transcript_ready */}
                {quickCheckState.status === "transcript_ready" && (
                  <div className="space-y-3" data-testid="quick-check-transcript-ready">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-1">
                        Your sentence
                      </p>
                      <p
                        className="text-sm rounded bg-[var(--brand-bg)] border border-[var(--brand-border)] px-3 py-2"
                        data-testid="quick-check-transcript"
                      >
                        {quickCheckState.transcript}
                      </p>
                    </div>
                    {/* Typed fallback — secondary, for accessibility / STT correction */}
                    <div>
                      <label
                        htmlFor="quick-check-transcript-edit"
                        className="block text-xs text-[var(--brand-muted)] mb-1"
                      >
                        Edit if needed (optional):
                      </label>
                      <textarea
                        id="quick-check-transcript-edit"
                        data-testid="transcript-input"
                        rows={2}
                        maxLength={500}
                        value={quickCheckState.transcript}
                        onChange={(e) =>
                          setQuickCheckState((prev) => ({
                            ...prev,
                            transcript: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="submit-check-btn"
                        onClick={handleSubmitCheck}
                        disabled={!quickCheckState.transcript.trim()}
                        aria-disabled={!quickCheckState.transcript.trim()}
                        className={`app-button px-4 py-2 text-sm ${!quickCheckState.transcript.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        Check Sentence
                      </button>
                      <button
                        type="button"
                        data-testid="record-again-btn"
                        onClick={handleRecordAgain}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Record Again
                      </button>
                      <button
                        type="button"
                        data-testid="skip-check-btn"
                        onClick={handleSkip}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Skip Quick Check
                      </button>
                    </div>
                  </div>
                )}

                {/* checking */}
                {quickCheckState.status === "checking" && (
                  <div data-testid="quick-check-checking">
                    <p className="text-sm text-[var(--brand-ink-soft)]">Checking your sentence…</p>
                  </div>
                )}

                {/* result states */}
                {(quickCheckState.status === "detected" ||
                  quickCheckState.status === "not_detected_or_partial" ||
                  quickCheckState.status === "skipped") && (
                  <div className="space-y-2" data-testid="quick-check-result">
                    {quickCheckState.status === "detected" && (
                      <p className="text-sm text-[var(--brand-teal-ink)] font-medium">
                        Pattern detected. Future Drill will start from Phase 3.
                      </p>
                    )}
                    {quickCheckState.status === "not_detected_or_partial" && (
                      <p className="text-sm text-[var(--brand-ink-soft)]">
                        Pattern not clearly detected. Future Drill will start from Phase 1.
                      </p>
                    )}
                    {quickCheckState.status === "skipped" && (
                      <p className="text-sm text-[var(--brand-ink-soft)]">
                        Quick check skipped. Future Drill will start from Phase 1.
                      </p>
                    )}
                  </div>
                )}

                {/* error_mic */}
                {quickCheckState.status === "error_mic" && (
                  <div className="space-y-3" data-testid="quick-check-error-mic">
                    <p className="text-sm text-[var(--brand-danger)]">
                      Microphone access was denied or is not supported in this browser. You can
                      type your sentence below instead.
                    </p>
                    {/* Typed fallback — primary when mic unavailable */}
                    <div>
                      <label
                        htmlFor="quick-check-transcript-fallback"
                        className="block text-sm font-medium mb-1"
                      >
                        Type or paste your sentence:
                      </label>
                      <textarea
                        id="quick-check-transcript-fallback"
                        data-testid="transcript-input"
                        rows={3}
                        maxLength={500}
                        placeholder="Type your sentence here…"
                        value={quickCheckState.transcript}
                        onChange={(e) =>
                          setQuickCheckState((prev) => ({
                            ...prev,
                            transcript: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="submit-check-btn"
                        onClick={handleSubmitCheck}
                        disabled={!quickCheckState.transcript.trim()}
                        aria-disabled={!quickCheckState.transcript.trim()}
                        className={`app-button px-4 py-2 text-sm ${!quickCheckState.transcript.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        Check Sentence
                      </button>
                      <button
                        type="button"
                        data-testid="retry-check-btn"
                        onClick={() =>
                          setQuickCheckState((prev) => ({
                            ...prev,
                            status: "recording_ready",
                            transcript: "",
                          }))
                        }
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Try Microphone Again
                      </button>
                      <button
                        type="button"
                        data-testid="skip-check-btn"
                        onClick={handleSkip}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Skip Quick Check
                      </button>
                    </div>
                  </div>
                )}

                {/* error_stt */}
                {quickCheckState.status === "error_stt" && (
                  <div className="space-y-2" data-testid="quick-check-error-stt">
                    <p className="text-sm text-[var(--brand-danger)]">
                      Speech transcription failed. Please try recording again.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="record-again-btn"
                        onClick={handleRecordAgain}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Record Again
                      </button>
                      <button
                        type="button"
                        data-testid="skip-check-btn"
                        onClick={handleSkip}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Skip Quick Check
                      </button>
                    </div>
                  </div>
                )}

                {/* error_check */}
                {quickCheckState.status === "error_check" && (
                  <div className="space-y-2" data-testid="quick-check-error-check">
                    <p className="text-sm text-[var(--brand-danger)]">
                      Unable to check that sentence. Please try again.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="retry-check-btn"
                        onClick={handleRetryCheck}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Try Again
                      </button>
                      <button
                        type="button"
                        data-testid="skip-check-btn"
                        onClick={handleSkip}
                        className="app-button-ghost px-4 py-2 text-sm"
                      >
                        Skip Quick Check
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* ── /Quick Spoken Check ────────────────────────────────── */}

              {/* Start Drill placeholder — always disabled */}
              <div data-testid="brief-start-drill">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="app-button px-4 py-2 text-sm opacity-50 cursor-not-allowed"
                  data-testid="start-drill-btn"
                >
                  Start Drill
                </button>
                <p className="text-xs text-[var(--brand-muted)] mt-2">
                  {displayEntryPhase
                    ? `Drill Mode will be available in a future update. Planned entry: Phase ${displayEntryPhase}.`
                    : "Drill Mode will be available in a future update."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2 — Drill Mode (placeholder) */}
      <section className="space-y-4 opacity-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-border)] text-xs font-bold text-[var(--brand-ink-soft)]">
            2
          </span>
          <h4 className="font-semibold text-[var(--brand-ink-soft)]">Drill Mode</h4>
        </div>
        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-teal)]">
              Phase: Contrastive Repetition
            </span>
            <span className="text-xs font-mono tabular-nums text-[var(--brand-muted)]">
              Time left: 02:00
            </span>
          </div>
          <div className="h-24 rounded bg-[var(--brand-bg)] border border-dashed border-[var(--brand-border)] flex items-center justify-center text-sm text-[var(--brand-muted)]">
            [ Transcript Placeholder ]
          </div>
          <div className="text-xs text-[var(--brand-muted)] border-b border-dotted cursor-pointer">
            Show Pattern Reference
          </div>
        </div>
      </section>

      {/* Section 3 — Session Summary (placeholder) */}
      <section className="space-y-4 opacity-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-border)] text-xs font-bold text-[var(--brand-ink-soft)]">
            3
          </span>
          <h4 className="font-semibold text-[var(--brand-ink-soft)]">Session Summary</h4>
        </div>
        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
          <p className="text-sm text-[var(--brand-muted)]">
            Summary placeholder. (Unlocked after drill completion.)
          </p>
        </div>
      </section>
    </div>
  );
}
