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
  },
) {
  const [internalPanel, setInternalPanel] = useState<ActiveSessionPanel>("podchat");
  const {
    activePanel,
    isActiveView = true,
    onActivePanelChange,
    latestSession = null,
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
          setIsLoading(false);
        } else {
          if (latestSession) {
            setWeaknessText(latestSession.mainWeakness || null);
            setTargetText(latestSession.retryTask || null);
          } else {
            setWeaknessText(null);
            setTargetText(null);
          }
          setIsLoading(false);
        }
      } catch (error) {
        if (!active) return;
        if (latestSession) {
          setWeaknessText(latestSession.mainWeakness || null);
          setTargetText(latestSession.retryTask || null);
        } else {
          setWeaknessText(null);
          setTargetText(null);
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

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--brand-ink)]">
          Active Session
        </h2>
      </div>

      {/* Weakness Context Banner or Loader */}
      {isLoading ? (
        <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 shadow-sm animate-pulse flex flex-col gap-2.5">
          <div className="h-4 bg-[var(--brand-border-strong)]/30 rounded w-24"></div>
          <div className="h-6 bg-[var(--brand-border-strong)]/30 rounded w-3/4 sm:w-1/2"></div>
          <div className="h-4 bg-[var(--brand-border-strong)]/30 rounded w-full sm:w-2/3 mt-1"></div>
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

      {/* Content Area */}
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm flex flex-col">
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
    </div>
  );
}
