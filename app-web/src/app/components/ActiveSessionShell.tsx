import { useState } from "react";
import { PodchatView, type PodchatViewProps } from "./PodchatView";
import { PatternDrillPrototype } from "./PatternDrillPrototype";

export type ActiveSessionPanel = "podchat" | "patternDrill";

export function ActiveSessionShell(
  props: PodchatViewProps & {
    activePanel?: ActiveSessionPanel;
    isActiveView?: boolean;
    onActivePanelChange?: (panel: ActiveSessionPanel) => void;
  },
) {
  const [internalPanel, setInternalPanel] = useState<ActiveSessionPanel>("podchat");
  const {
    activePanel,
    isActiveView = true,
    onActivePanelChange,
    ...podchatProps
  } = props;
  const panel = activePanel ?? internalPanel;
  const setPanel = (nextPanel: ActiveSessionPanel) => {
    if (activePanel === undefined) {
      setInternalPanel(nextPanel);
    }
    onActivePanelChange?.(nextPanel);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--brand-ink)]">
          Active Session
        </h2>
        <div
          role="group"
          aria-label="Active Session Mode"
          className="inline-flex rounded-xl bg-[var(--brand-surface-2)] p-1 border border-[var(--brand-border)] shadow-sm self-start sm:self-auto"
        >
          <button
            type="button"
            aria-pressed={panel === "podchat"}
            onClick={() => setPanel("podchat")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${
              panel === "podchat"
                ? "bg-[var(--brand-bg)] text-[var(--brand-ink)] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                : "text-[var(--brand-ink-soft)] hover:text-[var(--brand-ink)]"
            }`}
          >
            Podchat
          </button>
          <button
            type="button"
            aria-pressed={panel === "patternDrill"}
            onClick={() => setPanel("patternDrill")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${
              panel === "patternDrill"
                ? "bg-[var(--brand-bg)] text-[var(--brand-ink)] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                : "text-[var(--brand-ink-soft)] hover:text-[var(--brand-ink)]"
            }`}
          >
            Drill Mode
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm flex flex-col">
        {panel === "podchat" ? (
          <PodchatView {...podchatProps} isActiveView={isActiveView} />
        ) : (
          <PatternDrillPrototype onExit={() => setPanel("podchat")} />
        )}
      </div>
    </div>
  );
}
