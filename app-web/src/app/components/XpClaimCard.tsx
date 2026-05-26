type XpClaimCardProps = {
  claimableXp: number;
  alreadyClaimedToday: boolean;
  onClaimXp: () => void;
};

export function XpClaimCard({
  claimableXp,
  alreadyClaimedToday,
  onClaimXp,
}: XpClaimCardProps) {
  const canClaim = claimableXp > 0 && !alreadyClaimedToday;
  const buttonPrimary =
    "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            Daily Claim
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--brand-ink)]">
            {claimableXp} XP
          </p>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            Claim is available once per local day.
          </p>
          {alreadyClaimedToday && (
            <p className="mt-2 text-xs font-medium text-[var(--brand-gold)]">
              Claimed today. New pending XP is available tomorrow.
            </p>
          )}
          {!alreadyClaimedToday && claimableXp === 0 && (
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              No XP to claim yet. Rewards will appear after XP events are wired.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClaimXp}
          disabled={!canClaim}
          className={`${buttonPrimary} w-full sm:w-auto`}
        >
          {alreadyClaimedToday ? "Claimed Today" : "Claim XP"}
        </button>
      </div>
    </div>
  );
}
