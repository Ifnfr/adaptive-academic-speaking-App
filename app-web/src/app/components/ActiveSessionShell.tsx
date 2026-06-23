import { useEffect, useState } from "react";
import { PodchatView, type PodchatViewProps } from "./PodchatView";
import { PatternDrillPrototype } from "./PatternDrillPrototype";
import type { StoredSessionRecord } from "../lib/storage";

export type ActiveSessionPanel = "podchat" | "patternDrill";

export function ActiveSessionShell(
  props: PodchatViewProps & {
    activePanel?: ActiveSessionPanel;
    isActiveView?: boolean;
    onActivePanelChange?: (panel: ActiveSessionPanel) => void;
    latestSession?: StoredSessionRecord | null;
    dayStreak?: number;
  },
) {
  const [internalPanel, setInternalPanel] = useState<ActiveSessionPanel>("podchat");
  const {
    activePanel,
    isActiveView = true,
    onActivePanelChange,
    latestSession = null,
    dayStreak = 0,
    ...podchatProps
  } = props;
  const panel = activePanel ?? internalPanel;
  const setPanel = (nextPanel: ActiveSessionPanel) => {
    if (activePanel === undefined) {
      setInternalPanel(nextPanel);
    }
    onActivePanelChange?.(nextPanel);
  };

  const [weaknessText, setWeaknessText] = useState<string | null>(null);
  const [targetText, setTargetText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [weaknessError, setWeaknessError] = useState<boolean>(false);
  const [tips, setTips] = useState<string[]>([]);
  const [tipsLoading, setTipsLoading] = useState<boolean>(false);
  const [tipsError, setTipsError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000);

    async function fetchLatestWeakness() {
      try {
        const res = await fetch("/api/pattern-drill/latest-weakness", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error("API request failed");
        }

        const data = await res.json();
        if (!active) return;

        if (data.status === "found" && data.weakness) {
          setWeaknessText(data.weakness.title || null);
          setTargetText(data.weakness.practiceFocus || null);
          setWeaknessError(false);
          setIsLoading(false);
        } else {
          if (latestSession) {
            setWeaknessText(latestSession.mainWeakness || null);
            setTargetText(latestSession.retryTask || null);
          } else {
            setWeaknessText(null);
            setTargetText(null);
          }
          setWeaknessError(false);
          setIsLoading(false);
        }
      } catch (error) {
        if (!active) return;
        if (latestSession) {
          setWeaknessText(latestSession.mainWeakness || null);
          setTargetText(latestSession.retryTask || null);
          setWeaknessError(false);
        } else {
          setWeaknessText(null);
          setTargetText(null);
          setWeaknessError(true);
        }
        setIsLoading(false);
      }
    }

    fetchLatestWeakness();

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [latestSession]);

  useEffect(() => {
    if (!weaknessText) {
      setTips([]);
      setTipsError(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setTipsLoading(true);
    setTipsError(false);

    async function fetchTips() {
      try {
        const res = await fetch("/api/active-session/contextual-tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weaknessText }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Failed to fetch tips");
        }
        const data = await res.json();
        if (active && data.tips) {
          setTips(data.tips);
          setTipsError(false);
        }
      } catch (err) {
        console.error("Error fetching contextual tips:", err);
        if (active) {
          setTipsError(true);
        }
      } finally {
        if (active) {
          setTipsLoading(false);
        }
      }
    }

    fetchTips();

    return () => {
      active = false;
      controller.abort();
    };
  }, [weaknessText]);

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--brand-ink)]">
          Active Session
        </h2>
      </div>

      {/* Two-column layout grid on desktop (lg breakpoint) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (Wider, ~65% / 8 cols) - Main Workspace */}
        <div className="lg:col-span-8 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm flex flex-col">
          {panel === "podchat" ? (
            <PodchatView {...podchatProps} isActiveView={isActiveView} />
          ) : (
            <PatternDrillPrototype
              onExit={() => setPanel("podchat")}
              ttsProvider={podchatProps.ttsProvider}
              ttsVoiceProfile={podchatProps.ttsVoiceProfile}
              elevenLabsModelId={podchatProps.elevenLabsModelId}
            />
          )}
        </div>

        {/* Right Column (Narrower, ~35% / 4 cols) - Weakness Banner + Session Info */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          {/* Weakness Context Banner or Loader */}
          {isLoading ? (
            <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 shadow-sm animate-pulse flex flex-col gap-2.5">
              <div className="h-4 bg-[var(--brand-border-strong)]/30 rounded w-24"></div>
              <div className="h-6 bg-[var(--brand-border-strong)]/30 rounded w-3/4 sm:w-1/2"></div>
              <div className="h-4 bg-[var(--brand-border-strong)]/30 rounded w-full sm:w-2/3 mt-1"></div>
            </div>
          ) : weaknessError && !weaknessText ? (
            <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 shadow-sm">
              <p className="text-xs text-[var(--brand-ink-soft)]">
                Could not load weakness data. Check your connection.
              </p>
            </div>
          ) : (
            weaknessText && targetText && (
              <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[var(--brand-ink-soft)] text-xs font-semibold tracking-wider uppercase">
                    Last weakness
                  </span>
                  <p className="text-[var(--brand-ink)] text-base font-semibold">
                    {weaknessText}
                  </p>
                  <div className="text-[var(--brand-ink-soft)] text-sm mt-1">
                    <span className="font-medium text-[var(--brand-muted)]">Recommended: </span>
                    <span>{targetText}</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setPanel("patternDrill")}
                    className="rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] w-full sm:w-auto text-center"
                  >
                    Start Drill Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("podchat")}
                    className="text-sm font-medium text-[var(--brand-teal-ink)] hover:underline focus:outline-none focus:underline w-full sm:w-auto text-center sm:text-left py-2 sm:py-0"
                  >
                    or start Podchat
                  </button>
                </div>
              </div>
            )
          )}

          {/* Recent Progress Snapshot Card */}
          <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                Recent Progress
              </h3>
              <span className="font-mono text-xs font-semibold text-[var(--brand-gold)] flex items-center gap-1">
                🔥 {dayStreak} {dayStreak === 1 ? "day" : "days"}
              </span>
            </div>
            
            <div className="border-t border-[var(--brand-border)] pt-3 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--brand-ink-soft)]">Current Level</span>
                <span className="font-medium text-[var(--brand-ink)]">
                  {podchatProps.sessionLevel || "Intermediate"}
                </span>
              </div>

              {latestSession && (
                <div className="flex flex-col gap-1.5 border-t border-[var(--brand-border)] pt-2.5">
                  <span className="text-[11px] font-medium text-[var(--brand-ink-soft)] uppercase tracking-wider">
                    Last Session
                  </span>
                  <div className="rounded-xl bg-[var(--brand-surface-2)] p-3 flex flex-col gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--brand-ink-soft)]">Date</span>
                      <span className="font-medium text-[var(--brand-ink)]">
                        {latestSession.date}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--brand-ink-soft)]">Mode</span>
                      <span className="font-medium text-[var(--brand-ink)]">
                        {latestSession.mode}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs border-t border-[var(--brand-border)] pt-2.5">
                <span className="text-[var(--brand-ink-soft)]">Status</span>
                <span className="app-status app-status-success font-medium">
                  Session active
                </span>
              </div>
            </div>
          </div>

          {/* Contextual AI Tips Card */}
          {weaknessText && (
            tipsLoading ? (
              <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-sm animate-pulse flex flex-col gap-3">
                <div className="h-4 bg-[var(--brand-border-strong)]/20 rounded w-28"></div>
                <div className="border-t border-[var(--brand-border)] pt-3 flex flex-col gap-2.5">
                  <div className="h-3 bg-[var(--brand-border-strong)]/20 rounded w-full"></div>
                  <div className="h-3 bg-[var(--brand-border-strong)]/20 rounded w-11/12"></div>
                  <div className="h-3 bg-[var(--brand-border-strong)]/20 rounded w-4/5"></div>
                </div>
              </div>
            ) : tipsError ? (
              <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-sm flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                  AI Coach Tips
                </h3>
                <div className="border-t border-[var(--brand-border)] pt-3">
                  <p className="text-xs text-[var(--brand-ink-soft)]">
                    Could not load tips. Try refreshing.
                  </p>
                </div>
              </div>
            ) : (
              tips.length > 0 && (
                <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-sm flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                    AI Coach Tips
                  </h3>
                  <div className="border-t border-[var(--brand-border)] pt-3 flex flex-col gap-3">
                    {tips.map((tip, idx) => (
                      <div key={idx} className="flex gap-2.5 items-start">
                        <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--brand-teal)]/10 text-[var(--brand-teal)] text-xs font-semibold">
                          {idx + 1}
                        </span>
                        <p className="text-xs text-[var(--brand-ink-soft)] leading-relaxed">
                          {tip}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}
