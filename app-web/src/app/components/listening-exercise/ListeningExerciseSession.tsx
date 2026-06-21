import { useState, useEffect, useRef } from "react";
import { ListeningExerciseLayout } from "./ListeningExerciseLayout";
import { type Question } from "./QuestionList";

export interface ListeningExerciseSessionProps {
  initialCefrLevel?: string;
  initialSectionCount?: number;
  initialIsPlacement?: boolean;
  onSessionComplete?: (result: { overallScore: number; estimatedBand: string }) => void;
}

type StepType =
  | "idle"
  | "generating"
  | "loading_audio"
  | "ready"
  | "submitting"
  | "completed"
  | "error";

async function fetchTtsAudio(text: string): Promise<string> {
  const internalKey =
    process.env.NEXT_PUBLIC_INTERNAL_SPEECH_SECURITY_KEY || "test-internal-speech-key";

  const res = await fetch("/api/podchat/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": internalKey,
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`TTS service returned status ${res.status}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function splitTextIntoChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const rawSentence of sentences) {
    const s = rawSentence.trim();
    if (!s) continue;

    // Split sentences if they are single-handedly longer than 450 characters
    const splitSentences = s.length > 450 ? splitSentenceIfTooLong(s, 450) : [s];

    for (const subS of splitSentences) {
      if (!currentChunk) {
        currentChunk = subS;
      } else if (currentChunk.length + subS.length + 1 < 450) {
        currentChunk += " " + subS;
      } else {
        chunks.push(currentChunk);
        currentChunk = subS;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Merge extremely short trailing chunks (< 50 chars) into the previous chunk if possible
  if (chunks.length > 1) {
    const lastIdx = chunks.length - 1;
    if (chunks[lastIdx].length < 50) {
      if (chunks[lastIdx - 1].length + chunks[lastIdx].length + 1 < 450) {
        chunks[lastIdx - 1] = chunks[lastIdx - 1] + " " + chunks[lastIdx];
        chunks.pop();
      }
    }
  }

  return chunks;
}

function splitSentenceIfTooLong(sentence: string, maxLen = 450): string[] {
  if (sentence.length <= maxLen) return [sentence];
  const parts: string[] = [];
  let currentPart = "";
  const words = sentence.split(/(\s+)/);
  for (const word of words) {
    if (currentPart.length + word.length <= maxLen) {
      currentPart += word;
    } else {
      if (currentPart.trim()) {
        parts.push(currentPart.trim());
      }
      currentPart = word;
    }
  }
  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }
  return parts;
}

export function ListeningExerciseSession({
  initialCefrLevel = "B2",
  initialSectionCount = 3,
  initialIsPlacement = false,
  onSessionComplete,
}: ListeningExerciseSessionProps) {
  const [step, setStep] = useState<StepType>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Section details
  const [sectionId, setSectionId] = useState<string>("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [sectionCount] = useState(initialSectionCount);
  const [topic, setTopic] = useState("");
  const [audioUrls, setAudioUrls] = useState<(string | null)[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Session results
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [estimatedBand, setEstimatedBand] = useState<string | null>(null);
  
  // Error state and retry target tracking
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorPhase, setErrorPhase] = useState<"start" | "next" | "submit" | "complete" | "status" | "audio" | null>(null);

  // Polling loop for active section generation status
  useEffect(() => {
    if (step !== "generating" || !sessionId) return;

    let timeoutId: NodeJS.Timeout;

    async function pollStatus() {
      try {
        const res = await fetch(`/api/listening-exercise/session/${sessionId}/status`);
        if (!res.ok) {
          throw new Error("Unable to check generation progress.");
        }

        const data = await res.json();
        if (!isMountedRef.current) return;

        if (data.generation_status === "ready") {
          const sectionData = data.section;
          if (!sectionData) {
            throw new Error("Generated content data is missing from status.");
          }

          setSectionId(sectionData.id);
          setTopic(sectionData.topic);
          setQuestions(sectionData.questions || []);
          setSectionIndex(data.section_index);

          // Retrieve and cache passage audio
          setStep("loading_audio");
          try {
            const scriptText = sectionData.audio_script || "";
            const chunks = splitTextIntoChunks(scriptText);
            
            // Fetch chunk 0 immediately
            const firstChunkUrl = await fetchTtsAudio(chunks[0] || "");
            
            if (isMountedRef.current) {
              const initialUrls = new Array(chunks.length).fill(null);
              initialUrls[0] = firstChunkUrl;
              setAudioUrls(initialUrls);
              setStep("ready");

              // Asynchronously prefetch remaining chunks sequentially
              (async () => {
                for (let i = 1; i < chunks.length; i++) {
                  if (!isMountedRef.current) break;
                  try {
                    const chunkUrl = await fetchTtsAudio(chunks[i]);
                    if (isMountedRef.current) {
                      setAudioUrls((prev) => {
                        const updated = [...prev];
                        updated[i] = chunkUrl;
                        return updated;
                      });
                    }
                  } catch (prefetchErr) {
                    console.error(`Prefetch failed for chunk ${i}:`, prefetchErr);
                  }
                }
              })();
            }
          } catch (audioErr) {
            console.error("Audio download error:", audioErr);
            if (isMountedRef.current) {
              setStep("error");
              setErrorMsg("Failed to load audio track.");
              setErrorPhase("audio");
            }
          }
        } else if (data.generation_status === "failed") {
          setStep("error");
          setErrorMsg("The AI planner encountered a generation error.");
          setErrorPhase("status");
        } else {
          // Keep polling every 2 seconds
          timeoutId = setTimeout(pollStatus, 2000);
        }
      } catch (err: unknown) {
        console.error("Status check failed:", err);
        if (isMountedRef.current) {
          setStep("error");
          setErrorMsg(err instanceof Error ? err.message : "Failed to establish database connection.");
          setErrorPhase("status");
        }
      }
    }

    timeoutId = setTimeout(pollStatus, 2000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [step, sessionId]);

  // Clean up Blob URLs when unmounting
  useEffect(() => {
    return () => {
      audioUrls.forEach((url) => {
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [audioUrls]);

  const handleStartSession = async () => {
    setStep("generating");
    setErrorMsg(null);
    setErrorPhase(null);

    try {
      const res = await fetch("/api/listening-exercise/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cefr_level: initialCefrLevel,
          section_count: initialSectionCount,
          is_placement: initialIsPlacement,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to initialize listening exercise session.");
      }

      const data = await res.json();
      setSessionId(data.session_id);
    } catch (err: unknown) {
      console.error("Start session failed:", err);
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to start session.");
      setErrorPhase("start");
    }
  };

  const handleTriggerNextSection = async () => {
    setStep("generating");
    setErrorMsg(null);
    setErrorPhase(null);

    try {
      const res = await fetch("/api/listening-exercise/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!res.ok) {
        throw new Error("Failed to request next listening section.");
      }
    } catch (err: unknown) {
      console.error("Trigger next section failed:", err);
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to request next section.");
      setErrorPhase("next");
    }
  };

  const handleSubmit = async (userAnswers: Record<string, string>) => {
    // Preserve local state answers in case the request drops
    setAnswers(userAnswers);
    setStep("submitting");
    setErrorMsg(null);
    setErrorPhase(null);

    try {
      const res = await fetch(
        `/api/listening-exercise/session/${sessionId}/sections/${sectionId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: userAnswers }),
        }
      );

      if (!res.ok) {
        throw new Error("Unable to submit section answers.");
      }

      // Evict old Object URLs
      audioUrls.forEach((url) => {
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      setAudioUrls([]);

      const isFinalSection = sectionIndex + 1 >= sectionCount;

      if (!isFinalSection) {
        // Request next section generation
        const nextRes = await fetch("/api/listening-exercise/session/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!nextRes.ok) {
          throw new Error("Failed to trigger next section generation.");
        }

        // Flush answers for the next section
        setAnswers({});
        setStep("generating");
      } else {
        // Complete the session
        setStep("submitting");
        const completeRes = await fetch(
          `/api/listening-exercise/session/${sessionId}/complete`,
          {
            method: "POST",
          }
        );

        if (!completeRes.ok) {
          throw new Error("Failed to calculate assessment summary.");
        }

        const data = await completeRes.json();
        setOverallScore(data.overall_score);
        setEstimatedBand(data.estimated_band);
        setStep("completed");

        onSessionComplete?.({
          overallScore: data.overall_score,
          estimatedBand: data.estimated_band,
        });
      }
    } catch (err: unknown) {
      console.error("Submission error:", err);
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit answers.");
      setErrorPhase("submit");
    }
  };

  const handleRetry = () => {
    if (errorPhase === "start") {
      handleStartSession();
    } else if (errorPhase === "next") {
      handleTriggerNextSection();
    } else if (errorPhase === "submit") {
      handleSubmit(answers);
    } else if (errorPhase === "audio") {
      setStep("generating");
    } else {
      // General recovery
      if (sessionId) {
        setStep("generating");
      } else {
        handleStartSession();
      }
    }
  };

  const renderIdle = () => {
    return (
      <div className="flex flex-col gap-5 p-6 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-3xl shadow-sm text-center max-w-md mx-auto">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--brand-teal-soft)] flex items-center justify-center text-[var(--brand-teal)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path d="M13.75 7h-1.376a1.562 1.562 0 00-3.13 0H5.25a1 1 0 000 2h3.993a1.562 1.562 0 003.13 0h1.377a1 1 0 100-2zM5.25 12h5.124a1.562 1.562 0 003.13 0h1.246a1 1 0 100-2h-1.247a1.562 1.562 0 00-3.13 0H5.25a1 1 0 100 2z" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-bold text-[var(--brand-ink)]">
            Listening Exercise
          </h2>
          <p className="text-xs text-[var(--brand-ink-soft)] leading-relaxed">
            Test your academic listening ability. You will listen to passages
            and answer True/False, Multiple Choice, and Fill-in-the-Blank items.
          </p>
        </div>
        <button
          type="button"
          onClick={handleStartSession}
          className="w-full py-3 bg-[var(--brand-teal)] hover:bg-[var(--brand-teal-ink)] text-white font-bold rounded-xl transition-all shadow-sm active:scale-[0.98]"
        >
          Start Assessment
        </button>
      </div>
    );
  };

  const renderGenerating = (message: string) => {
    return (
      <div className="flex flex-col items-center justify-center gap-5 p-10 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-3xl shadow-sm max-w-md mx-auto text-center">
        <svg
          className="animate-spin h-10 w-10 text-[var(--brand-teal)]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-[var(--brand-ink)]">
            Preparing Session
          </span>
          <span className="text-xs text-[var(--brand-muted)]">{message}</span>
        </div>
      </div>
    );
  };

  const renderCompleted = () => {
    return (
      <div className="flex flex-col gap-5 p-8 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-3xl shadow-sm max-w-md mx-auto text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--brand-success-soft)] flex items-center justify-center text-[var(--brand-success-ink)] border border-[var(--brand-success)]/10 shadow-inner">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.748-5.25z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-[var(--brand-ink)]">
            Exercise Complete
          </h2>
          <span className="text-xs text-[var(--brand-muted)]">
            Your results have been processed and stored.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-2xl">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">
              Overall Score
            </span>
            <span className="text-2xl font-black text-[var(--brand-ink)]">
              {overallScore}%
            </span>
          </div>
          <div className="flex flex-col border-l border-[var(--brand-border)]">
            <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">
              Estimated Band
            </span>
            <span className="text-2xl font-black text-[var(--brand-teal)]">
              {estimatedBand}
            </span>
          </div>
        </div>

        <div
          data-testid="listening-disclaimer"
          className="p-4 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-2xl text-[10px] text-[var(--brand-muted)] text-left leading-relaxed flex gap-2.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 text-[var(--brand-muted)] shrink-0 mt-0.5"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <span className="font-bold block text-[var(--brand-ink-soft)] mb-0.5">Disclaimer</span>
            Important: The &quot;Estimated Listening Level&quot; is an internal Fonetik estimate.
            It is NOT a certified or officially recognized IELTS or TOEFL score, and
            must not be used for visa, academic admission, or official certification purposes.
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setStep("idle");
            setSessionId(null);
            setAnswers({});
            setOverallScore(null);
            setEstimatedBand(null);
          }}
          className="w-full py-3 border border-[var(--brand-border)] hover:bg-[var(--brand-surface-2)] text-[var(--brand-ink-soft)] font-bold rounded-xl transition-all"
        >
          Take Another Exercise
        </button>
      </div>
    );
  };

  const renderError = () => {
    return (
      <div className="flex flex-col gap-5 p-6 bg-[var(--brand-coral-soft)] border border-[var(--brand-coral)]/30 rounded-3xl shadow-sm text-center max-w-md mx-auto">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-white border border-[var(--brand-coral)]/20 flex items-center justify-center text-[var(--brand-coral)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold text-[var(--brand-coral)]">
            An error occurred
          </h2>
          <p className="text-xs text-[var(--brand-ink-soft)] leading-relaxed">
            {errorMsg || "A temporary network disruption was detected."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStep("idle");
              setSessionId(null);
              setAnswers({});
            }}
            className="flex-1 py-2.5 border border-[var(--brand-border)] bg-white hover:bg-[var(--brand-surface-2)] text-xs font-bold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRetry}
            className="flex-1 py-2.5 bg-[var(--brand-teal)] hover:bg-[var(--brand-teal-ink)] text-white text-xs font-bold rounded-xl transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  };

  switch (step) {
    case "idle":
      return renderIdle();
    case "generating":
      return renderGenerating("Generating audio script and layout plans...");
    case "loading_audio":
      return renderGenerating("Downloading listening audio passage...");
    case "submitting":
      return renderGenerating("Grading results and computing scores...");
    case "completed":
      return renderCompleted();
    case "error":
      return renderError();
    case "ready":
      return (
        <ListeningExerciseLayout
          cefrLevel={initialCefrLevel}
          sectionIndex={sectionIndex}
          sectionCount={sectionCount}
          topic={topic}
          audioUrls={audioUrls}
          questions={questions}
          onSubmit={handleSubmit}
        />
      );
    default:
      return renderIdle();
  }
}
