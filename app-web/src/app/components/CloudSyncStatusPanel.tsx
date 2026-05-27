"use client";

import { useState } from "react";
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
      restoreEnabled: boolean;
      importEnabled: boolean;
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
      restoreEnabled: false,
      importEnabled: false,
    };
  }

  if (result.status !== "loaded") {
    return { visible: false };
  }

  if (result.plan.status === "no-op") {
    return { visible: false };
  }

  const isRestore = result.plan.status === "restore-available";
  const isImport = result.plan.status === "import-available";

  return {
    visible: true,
    title: isRestore ? "Cloud restore available" : "Cloud import available",
    description: isRestore
      ? "Cloud data is available for this browser. No local data has been changed."
      : "Cloud has safe additions or updates to review. No local data has been changed.",
    actionNote: isRestore
      ? "Review the counts before restoring cloud data."
      : "Review the counts before importing cloud data.",
    tone: "info",
    counts: DOMAIN_ORDER.map((key) => ({
      key,
      label: DOMAIN_LABELS[key],
      value: result.plan.counts[key],
    })),
    reasons: result.plan.reasons,
    restoreEnabled: isRestore,
    importEnabled: isImport,
  };
}

export type CloudRestoreActionResult =
  | { status: "restored" }
  | { status: "aborted-local-not-empty" }
  | { status: "failed" };

export type CloudImportActionResult =
  | { status: "imported" }
  | { status: "aborted-active-session" }
  | { status: "aborted-local-changed" }
  | { status: "failed" };

type CloudSyncStatusPanelProps = {
  result: CloudSnapshotRuntimeResult | null;
  onConfirmRestore?: () => Promise<CloudRestoreActionResult>;
  onConfirmImport?: () => Promise<CloudImportActionResult>;
};

export function CloudSyncStatusPanel({
  result,
  onConfirmRestore,
  onConfirmImport,
}: CloudSyncStatusPanelProps) {
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importCompleted, setImportCompleted] = useState(false);
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

        {model.restoreEnabled && onConfirmRestore && !restoreCompleted && (
          <div className="flex flex-col gap-3 border-t border-[var(--brand-border)] pt-3">
            {!confirmRestoreOpen ? (
              <button
                type="button"
                className="w-fit rounded-full border border-[var(--brand-teal)] bg-[var(--brand-teal)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                onClick={() => {
                  setRestoreMessage(null);
                  setConfirmRestoreOpen(true);
                }}
              >
                Restore to this browser
              </button>
            ) : (
              <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                  Restore cloud data to this browser?
                </h3>
                <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                  fonetik will copy the merged cloud snapshot into this browser.
                  Existing local data will not be cleared. Because this browser
                  currently has no local learning data, this is treated as a
                  restore.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-xs font-medium text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                    disabled={restoreBusy}
                    onClick={() => {
                      setConfirmRestoreOpen(false);
                      setRestoreMessage(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--brand-teal)] bg-[var(--brand-teal)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={restoreBusy}
                    onClick={async () => {
                      setRestoreBusy(true);
                      try {
                        const result = await onConfirmRestore();
                        if (result.status === "restored") {
                          setRestoreMessage(
                            "Cloud data restored to this browser. Local storage remains the source of truth.",
                          );
                          setRestoreCompleted(true);
                          setConfirmRestoreOpen(false);
                        } else if (result.status === "aborted-local-not-empty") {
                          setRestoreMessage(
                            "Restore was not applied. Local data changed before confirmation, so your browser data was left untouched.",
                          );
                        } else {
                          setRestoreMessage(
                            "Restore could not be completed. Local data is safe.",
                          );
                        }
                      } finally {
                        setRestoreBusy(false);
                      }
                    }}
                  >
                    Confirm restore
                  </button>
                </div>
              </div>
            )}
            {restoreMessage && (
              <p className="text-xs font-medium text-[var(--brand-ink-soft)]">
                {restoreMessage}
              </p>
            )}
          </div>
        )}

        {model.importEnabled && onConfirmImport && !importCompleted && (
          <div className="flex flex-col gap-3 border-t border-[var(--brand-border)] pt-3">
            {!confirmImportOpen ? (
              <button
                type="button"
                className="w-fit rounded-full border border-[var(--brand-teal)] bg-[var(--brand-teal)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                onClick={() => {
                  setImportMessage(null);
                  setConfirmImportOpen(true);
                }}
              >
                Import to this browser
              </button>
            ) : (
              <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                  Import cloud data to this browser?
                </h3>
                <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                  fonetik will merge safe cloud additions and updates into this
                  browser. Local data will not be cleared. Cloud data will not
                  be changed.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-xs font-medium text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                    disabled={importBusy}
                    onClick={() => {
                      setConfirmImportOpen(false);
                      setImportMessage(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--brand-teal)] bg-[var(--brand-teal)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={importBusy}
                    onClick={async () => {
                      setImportBusy(true);
                      try {
                        const result = await onConfirmImport();
                        if (result.status === "imported") {
                          setImportMessage(
                            "Cloud data imported to this browser. Local storage remains the source of truth.",
                          );
                          setImportCompleted(true);
                          setConfirmImportOpen(false);
                        } else if (result.status === "aborted-active-session") {
                          setImportMessage(
                            "Import was not applied. Finish the active session before importing cloud data.",
                          );
                        } else if (result.status === "aborted-local-changed") {
                          setImportMessage(
                            "Import was not applied. Local data changed before confirmation, so your browser data was left untouched.",
                          );
                        } else {
                          setImportMessage(
                            "Import could not be completed. Local data is safe.",
                          );
                        }
                      } finally {
                        setImportBusy(false);
                      }
                    }}
                  >
                    Confirm import
                  </button>
                </div>
              </div>
            )}
            {importMessage && (
              <p className="text-xs font-medium text-[var(--brand-ink-soft)]">
                {importMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
