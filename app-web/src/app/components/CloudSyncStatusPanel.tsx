"use client";

import type { CloudSnapshotRuntimeResult } from "../lib/storage/cloud-snapshot-runtime";
import type {
  DomainCounts,
  DomainKey,
  SyncMergeReason,
} from "../lib/storage/sync-merge";

const DOMAIN_LABELS: Record<DomainKey, string> = {
  sessions: "Sessions",
  vocabulary: "Vocabulary",
  xpProfile: "XP profile",
  xpEvents: "XP events",
  badges: "Badges",
};

const DOMAIN_ORDER: DomainKey[] = [
  "sessions",
  "vocabulary",
  "xpProfile",
  "xpEvents",
  "badges",
];

export type CloudSyncStatusPanelModel =
  | {
      visible: false;
    }
  | {
      visible: true;
      title: string;
      description: string;
      actionNote: string;
      tone: "info" | "warning";
      counts: Array<{
        key: DomainKey;
        label: string;
        value: DomainCounts;
      }>;
      reasons: SyncMergeReason[];
    };

export function buildCloudSyncStatusPanelModel(
  result: CloudSnapshotRuntimeResult | null,
): CloudSyncStatusPanelModel {
  if (!result) return { visible: false };

  if (result.status === "failed") {
    return {
      visible: true,
      title: "Cloud check failed",
      description: "Cloud check failed - local data is safe.",
      actionNote: "No restore or import action is available from this panel.",
      tone: "warning",
      counts: [],
      reasons: [],
    };
  }

  if (result.status !== "loaded") {
    return { visible: false };
  }

  if (result.plan.status === "no-op") {
    return { visible: false };
  }

  const isRestore = result.plan.status === "restore-available";

  return {
    visible: true,
    title: isRestore ? "Cloud restore available" : "Cloud import available",
    description: isRestore
      ? "Cloud data is available for this browser. No local data has been changed."
      : "Cloud has safe additions or updates to review. No local data has been changed.",
    actionNote: "Restore/import controls are not enabled yet.",
    tone: "info",
    counts: DOMAIN_ORDER.map((key) => ({
      key,
      label: DOMAIN_LABELS[key],
      value: result.plan.counts[key],
    })),
    reasons: result.plan.reasons,
  };
}

type CloudSyncStatusPanelProps = {
  result: CloudSnapshotRuntimeResult | null;
};

export function CloudSyncStatusPanel({ result }: CloudSyncStatusPanelProps) {
  const model = buildCloudSyncStatusPanelModel(result);
  if (!model.visible) return null;

  const toneClass =
    model.tone === "warning"
      ? "border-amber-300 bg-amber-50"
      : "border-[var(--brand-border)] bg-[var(--brand-surface)]";

  return (
    <section
      aria-label="Cloud sync status"
      className={`rounded-2xl border px-5 py-4 shadow-sm ${toneClass}`}
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            Cloud sync preview
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
            {model.title}
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            {model.description}
          </p>
        </div>

        {model.counts.length > 0 && (
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {model.counts.map(({ key, label, value }) => (
              <div
                key={key}
                className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2"
              >
                <dt className="text-[11px] font-medium text-[var(--brand-muted)]">
                  {label}
                </dt>
                <dd className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  {value.cloud} cloud, {value.local} local, {value.merged} after
                  merge
                </dd>
              </div>
            ))}
          </dl>
        )}

        {model.reasons.length > 0 && (
          <ul className="space-y-1 text-xs text-[var(--brand-ink-soft)]">
            {model.reasons.map((reason, index) => (
              <li key={`${reason.domain}-${index}`}>
                <span className="font-medium">
                  {reason.level === "warning" ? "Warning" : "Note"}:
                </span>{" "}
                {reason.message}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs font-medium text-[var(--brand-ink-soft)]">
          {model.actionNote}
        </p>
      </div>
    </section>
  );
}
