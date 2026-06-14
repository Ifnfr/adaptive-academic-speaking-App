type PatternDrillPrototypeProps = {
  onExit: () => void;
};

export function PatternDrillPrototype({ onExit }: PatternDrillPrototypeProps) {
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
        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3">
          <p className="text-sm font-medium">Target Pattern: &quot;Not only... but also...&quot;</p>
          <p className="text-sm text-[var(--brand-ink-soft)]">
            Quality Criteria: Must use parallel structure in both clauses.
          </p>
          <div className="rounded bg-[var(--brand-bg)] p-3 border border-[var(--brand-border)]">
            <p className="text-xs font-mono text-[var(--brand-muted)] mb-1">
              Response Pattern
            </p>
            <p className="text-sm">Not only [Auxiliary Verb] [Subject] [Verb], but [Subject] also [Verb].</p>
          </div>
          <div className="rounded bg-[var(--brand-bg)] p-3 border border-[var(--brand-border)]">
            <p className="text-xs font-mono text-[var(--brand-muted)] mb-1">
              Mini Example <span className="text-[10px] text-[var(--brand-muted)] font-normal ml-2">Illustration only — do not memorize or copy.</span>
            </p>
            <p className="text-sm">Not only did they improve efficiency, but they also reduced costs.</p>
          </div>
          <p className="text-xs text-[var(--brand-warning)]">
            Common Mistakes: Forgetting the auxiliary verb inversion (e.g., &quot;Not only they improved...&quot;).
          </p>
          <button type="button" className="app-button px-4 py-2 text-sm mt-2">
            Start Quick Spoken Check
          </button>
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
            <span className="inline-flex items-center gap-1 rounded bg-[var(--brand-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand-gold)]">
              ★ 5 XP
            </span>
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
