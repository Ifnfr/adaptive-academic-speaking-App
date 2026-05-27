import { expect, test } from "@playwright/test";
import {
  buildCloudSyncStatusPanelModel,
} from "../src/app/components/CloudSyncStatusPanel";
import type { CloudSnapshotRuntimeResult } from "../src/app/lib/storage/cloud-snapshot-runtime";
import type { SyncMergePlan } from "../src/app/lib/storage/sync-merge";

const emptyCounts = {
  local: 0,
  cloud: 0,
  merged: 0,
  added: 0,
  updated: 0,
};

function createPlan(status: SyncMergePlan["status"]): SyncMergePlan {
  return {
    status,
    reasons: [
      {
        domain: "xpProfile",
        level: "warning",
        message:
          "Local and cloud XP profiles disagree. Local was kept; review before overwriting.",
      },
    ],
    counts: {
      sessions: { local: 0, cloud: 2, merged: 2, added: 2, updated: 0 },
      vocabulary: { local: 1, cloud: 3, merged: 3, added: 2, updated: 1 },
      xpProfile: { local: 1, cloud: 1, merged: 1, added: 0, updated: 1 },
      xpEvents: { local: 0, cloud: 4, merged: 4, added: 4, updated: 0 },
      badges: { local: 0, cloud: 1, merged: 1, added: 1, updated: 0 },
    },
    merged: {
      sessions: [],
      vocabulary: [],
      xpProfile: null,
      xpEvents: [],
      badges: [],
    },
  };
}

function loadedResult(status: SyncMergePlan["status"]): CloudSnapshotRuntimeResult {
  return {
    status: "loaded",
    cloud: {
      sessions: [],
      vocabulary: [],
      xpProfile: null,
      xpEvents: [],
      badges: [],
    },
    plan: createPlan(status),
  };
}

test.describe("CloudSyncStatusPanel model", () => {
  test("hides for local-only and no-op states", () => {
    const noOpResult: CloudSnapshotRuntimeResult = {
      status: "loaded",
      cloud: {
        sessions: [],
        vocabulary: [],
        xpProfile: null,
        xpEvents: [],
        badges: [],
      },
      plan: {
        ...createPlan("no-op"),
        reasons: [],
        counts: {
          sessions: emptyCounts,
          vocabulary: emptyCounts,
          xpProfile: emptyCounts,
          xpEvents: emptyCounts,
          badges: emptyCounts,
        },
      },
    };

    expect(buildCloudSyncStatusPanelModel(null)).toEqual({ visible: false });
    expect(buildCloudSyncStatusPanelModel(noOpResult)).toEqual({
      visible: false,
    });
  });

  test("shows read-only restore messaging and counts", () => {
    const model = buildCloudSyncStatusPanelModel(
      loadedResult("restore-available"),
    );

    expect(model.visible).toBe(true);
    if (!model.visible) return;
    expect(model.title).toBe("Cloud restore available");
    expect(model.description).toContain("No local data has been changed.");
    expect(model.actionNote).toBe(
      "Review the counts before restoring cloud data.",
    );
    expect(model.restoreEnabled).toBe(true);
    expect(model.importEnabled).toBe(false);
    expect(model.counts.find((row) => row.key === "sessions")?.value.cloud).toBe(
      2,
    );
  });

  test("enables import action only for import-available messaging", () => {
    const model = buildCloudSyncStatusPanelModel(
      loadedResult("import-available"),
    );

    expect(model.visible).toBe(true);
    if (!model.visible) return;
    expect(model.title).toBe("Cloud import available");
    expect(model.description).toContain("No local data has been changed.");
    expect(model.actionNote).toBe(
      "Review the counts before importing cloud data.",
    );
    expect(model.restoreEnabled).toBe(false);
    expect(model.importEnabled).toBe(true);
    expect(model.reasons).toEqual([
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining("Local and cloud XP profiles disagree"),
      }),
    ]);
    expect(
      model.counts.find((row) => row.key === "vocabulary")?.value.updated,
    ).toBe(1);
  });

  test("shows failed cloud check safety copy", () => {
    const model = buildCloudSyncStatusPanelModel({
      status: "failed",
      reason: "cloud-read-failed",
    });

    expect(model).toEqual({
      visible: true,
      title: "Cloud check failed",
      description: "Cloud check failed - local data is safe.",
      actionNote: "No restore or import action is available from this panel.",
      tone: "warning",
      counts: [],
      reasons: [],
      restoreEnabled: false,
      importEnabled: false,
    });
  });

  test("does not touch localStorage while building panel state", () => {
    const originalLocalStorage = globalThis.localStorage;
    const writes: string[] = [];

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("localStorage getItem should not be called");
        },
        setItem: () => {
          writes.push("setItem");
          throw new Error("localStorage setItem should not be called");
        },
        removeItem: () => {
          writes.push("removeItem");
          throw new Error("localStorage removeItem should not be called");
        },
      },
    });

    try {
      const model = buildCloudSyncStatusPanelModel(
        loadedResult("restore-available"),
      );
      expect(model.visible).toBe(true);
      expect(writes).toEqual([]);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});
