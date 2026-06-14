import { useState, useEffect, useRef } from "react";

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

type PatternDrillPrototypeProps = {
  onExit: () => void;
};

export function PatternDrillPrototype({ onExit }: PatternDrillPrototypeProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [briefState, setBriefState] = useState<BriefState>({ status: "idle" });
  const briefAbortRef = useRef<AbortController | null>(null);

  // Fetch latest weakness on mount
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchWeakness() {
      try {
        const res = await fetch("/api/pattern-drill/latest-weakness", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
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

  // Abort any in-flight brief request on unmount
  useEffect(() => {
    return () => {
      briefAbortRef.current?.abort();
    };
  }, []);

  // Derived: button enabled only when weakness is found and not already generating
  const canGenerate =
    state.status === "found" && !!state.weakness && briefState.status !== "generating";

  async function handleGenerateBrief() {
    if (!canGenerate) return;

    // Abort any previous in-flight request
    briefAbortRef.current?.abort();
    const controller = new AbortController();
    briefAbortRef.current = controller;

    setBriefState({ status: "generating" });

    try {
      const res = await fetch("/api/pattern-brief/generate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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
      if ((err as Error)?.name === "AbortError") {
        // Stale request — ignore silently
        return;
      }
      setBriefState({ status: "error" });
    }
  }

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

  // Derive disabled reason for non-found states
  function getDisabledReason(): string | null {
    if (state.status === "loading") return "Loading your weakness data…";
    if (state.status === "empty") return "No weakness data yet. Complete an evaluated Podchat session first.";
    if (state.status === "insufficient") return "More specific repeated feedback is needed before generating a brief.";
    if (state.status === "error") return "Weakness data could not be loaded.";
    if (briefState.status === "generating") return null; // button disabled via canGenerate, no extra copy needed
    return null;
  }

  const disabledReason = getDisabledReason();

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">Pattern Drill</h3>
          <p className="text-sm text-[var(--brand-ink-soft)] mt-1">
            Compact Prototype Mode. (No backend features active.)
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="app-button-ghost px-3 py-1.5 text-sm"
        >
          Exit to Podchat
        </button>
      </div>

      {/* Weakness Check & Brief */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-xs font-bold text-[var(--brand-teal-ink)]">
            1
          </span>
          <h4 className="font-semibold">Latest Weakness Check &amp; Brief</h4>
        </div>

        <div
          className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3"
        >
          {state.status === "loading" && (
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="weakness-loading">
              Checking your latest speaking weakness...
            </p>
          )}

          {state.status === "error" && (
            <p className="text-sm text-[var(--brand-danger)]" data-testid="weakness-error">
              Could not load weakness data. Try again later.
            </p>
          )}

          {state.status === "empty" && (
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="weakness-empty">
              No speaking weakness data yet. Complete an evaluated Podchat session first.
            </p>
          )}

          {state.status === "insufficient" && (
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="weakness-insufficient">
              Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete more evaluated Podchat sessions so Fonetik can detect a repeated pattern.
            </p>
          )}

          {/* Weakness details — stays visible even after brief is generated */}
          {state.status === "found" && state.weakness && (
            <div className="space-y-4" data-testid="weakness-found">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--brand-teal-ink)] font-semibold">
                  Recommended Weakness
                </p>
                <h5 className="text-base font-semibold mt-1">
                  {state.weakness.description}
                </h5>
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
                  <span className="font-medium">{getConfidenceLabel(state.weakness.derivedConfidence)}</span>
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
              {briefState.status === "generating" ? "Building your pattern brief…" : "Generate Pattern Brief"}
            </button>

            {/* Disabled reason explanation */}
            {!canGenerate && disabledReason && (
              <p className="text-xs text-[var(--brand-muted)] mt-2" data-testid="generate-disabled-reason">
                {disabledReason}
              </p>
            )}

            {/* Error state — safe copy only, retry available */}
            {briefState.status === "error" && (
              <p className="text-sm text-[var(--brand-danger)] mt-2" data-testid="brief-error">
                Unable to generate. Please try again.
              </p>
            )}
          </div>

          {/* Generated Brief — sections in required order */}
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

              {/* 1. Quality Criteria */}
              <div data-testid="brief-quality-criteria">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                  Quality Criteria
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {briefState.brief.qualityCriteria.map((criterion, idx) => (
                    <li key={idx} className="text-sm">
                      {criterion}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 2. Response Pattern */}
              <div data-testid="brief-response-pattern">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                  Response Pattern
                </p>
                <p className="text-sm font-medium mb-2">{briefState.brief.responsePattern.name}</p>
                <ol className="list-decimal pl-5 space-y-1">
                  {briefState.brief.responsePattern.steps.map((step, idx) => (
                    <li key={idx} className="text-sm font-mono text-[var(--brand-teal-ink)]">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* 3. Mini Example */}
              <div data-testid="brief-mini-example">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                  Mini Example
                </p>
                <div className="rounded bg-[var(--brand-bg)] p-3 border border-[var(--brand-border)] space-y-2">
                  <p className="text-sm">{briefState.brief.miniExample}</p>
                  <p className="text-xs italic text-[var(--brand-muted)]" data-testid="mini-example-warning">
                    Illustration only — do not memorize or copy.
                  </p>
                </div>
              </div>

              {/* 4. Common Mistakes */}
              <div data-testid="brief-common-mistakes">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)] mb-2">
                  Common Mistakes to Avoid
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {briefState.brief.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="text-sm">
                      {mistake}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 5. Start Drill placeholder */}
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
                  Drill Mode will be available in a future update.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Drill Mode — placeholder */}
      <section className="space-y-4 opacity-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-border)] text-xs font-bold text-[var(--brand-ink-soft)]">
            2
          </span>
          <h4 className="font-semibold text-[var(--brand-ink-soft)]">Drill Mode</h4>
        </div>
        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-teal)]">Phase: Contrastive Repetition</span>
            <span className="text-xs font-mono tabular-nums text-[var(--brand-muted)]">Time left: 02:00</span>
          </div>
          <div className="h-24 rounded bg-[var(--brand-bg)] border border-dashed border-[var(--brand-border)] flex items-center justify-center text-sm text-[var(--brand-muted)]">
            [ Transcript Placeholder ]
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--brand-muted)] border-b border-dotted cursor-pointer">
              Show Pattern Reference
            </div>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="space-y-4 opacity-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-border)] text-xs font-bold text-[var(--brand-ink-soft)]">
            3
          </span>
          <h4 className="font-semibold text-[var(--brand-ink-soft)]">Session Summary</h4>
        </div>
        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
          <p className="text-sm text-[var(--brand-muted)]">Summary placeholder. (Unlocked after drill completion.)</p>
        </div>
      </section>
    </div>
  );
}
