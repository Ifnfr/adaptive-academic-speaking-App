import { useState, useEffect } from "react";

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

type PatternDrillPrototypeProps = {
  onExit: () => void;
};

export function PatternDrillPrototype({ onExit }: PatternDrillPrototypeProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

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

      {/* Weakness Check / Brief */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-xs font-bold text-[var(--brand-teal-ink)]">
            1
          </span>
          <h4 className="font-semibold">Latest Weakness Check &amp; Brief</h4>
        </div>

        <div
          role="region"
          aria-live="polite"
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

              <div className="rounded border border-dashed border-[var(--brand-border)] p-3 bg-[var(--brand-bg)]/50">
                <p className="text-xs font-semibold text-[var(--brand-ink-soft)] uppercase tracking-wider">
                  Pattern Brief Preview
                </p>
                <p className="text-sm text-[var(--brand-muted)] mt-1">
                  Pattern Brief is not generated yet. Finish your speaking analysis to view the full practice brief.
                </p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="app-button px-4 py-2 text-sm opacity-50 cursor-not-allowed"
            >
              Generate Pattern Brief
            </button>
            <p className="text-xs text-[var(--brand-muted)] mt-2">
              Pattern Brief generation is not active in this milestone.
            </p>
          </div>
        </div>
      </section>

      {/* Spoken Check & Drill Mode */}
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
