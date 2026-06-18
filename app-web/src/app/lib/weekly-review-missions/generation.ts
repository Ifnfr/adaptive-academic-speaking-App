import {
  classifyWeeklyMissionDataSufficiency,
  createWeeklyMissionId,
  deriveWeeklyMissionStatus,
  validateWeeklyMissionTarget,
  type WeeklyMission,
  type WeeklyMissionDataSufficiency,
  type WeeklyMissionMetricType,
  type WeeklyMissionRouteTarget,
  type WeeklyMissionSourceFeature,
  type WeeklyMissionReviewStatus,
} from "./index";
import type { WeeklyMissionSourceSnapshot } from "../storage/supabase-weekly-mission-review-adapter";

export type WeeklyMissionAiInput = {
  weekStart: string;
  weekEnd: string;
  enabledMetricTypes: WeeklyMissionMetricType[];
  dataSufficiency: WeeklyMissionDataSufficiency;
  sourceCounts: {
    podchatSessions: number;
    patternDrillSessions: number;
    vocabularyCollected: number;
    vocabularySentencesSubmitted: number;
    vocabularyCorrectionsSaved: number;
    articlePracticeCompleted: number;
    repeatedWeaknessCount: number;
  };
  speakingMinutes: number;
  activeDays: string[];
  topWeaknesses: Array<{
    category: string;
    label: string;
    count: number;
    practiceFocus?: string;
  }>;
  priorIncompleteMissions: Array<{
    metricType: WeeklyMissionMetricType;
    title: string;
    targetValue: number;
  }>;
  userLevel?: string;
};

type ProposedMission = {
  title: string;
  description: string;
  reason: string;
  weaknessTarget: WeeklyMission["weaknessTarget"];
  metricType: WeeklyMissionMetricType;
  targetValue: number;
  unit: string;
  sourceFeatures: WeeklyMissionSourceFeature[];
  recommendedAction: WeeklyMission["recommendedAction"];
};

export type WeeklyMissionAiOutput = {
  diagnosisSummary: string;
  dataSufficiency: WeeklyMissionDataSufficiency;
  topWeaknesses: Array<{
    category: string;
    label: string;
    reason: string;
  }>;
  missions: ProposedMission[];
};

export type FinalizeWeeklyMissionsInput = {
  ownerId: string;
  weekStart: string;
  weekEnd: string;
  createdAt: string;
  serverDataSufficiency: WeeklyMissionDataSufficiency;
  sourceSnapshot: WeeklyMissionSourceSnapshot;
  enabledMetricTypes: WeeklyMissionMetricType[];
  proposedOutput: WeeklyMissionAiOutput;
  now: Date;
};

const DATA_SUFFICIENCY_VALUES = new Set(["starter", "partial", "strong"]);
const ROUTE_TARGETS = new Set<WeeklyMissionRouteTarget>([
  "podchat",
  "pattern_drill",
  "vocabulary",
  "article_practice",
  "commonplace",
]);
const SOURCE_FEATURES = new Set<WeeklyMissionSourceFeature>([
  "podchat",
  "pattern_drill",
  "vocabulary",
  "article_practice",
  "commonplace",
]);
const FORBIDDEN_OUTPUT_KEYS = new Set([
  "currentvalue",
  "current_value",
  "status",
  "ownerid",
  "owner_id",
  "provider",
  "source_snapshot",
  "raw",
  "transcript",
  "answer",
  "email",
  "prompt",
  "model",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => {
    const normalized = key.replace(/[^a-z0-9_]/gi, "").toLowerCase();
    return FORBIDDEN_OUTPUT_KEYS.has(normalized) || hasForbiddenKey(nested);
  });
}

function readString(source: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = source[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function extractJsonObject(raw: string): string | null {
  const text = stripCodeFence(raw);
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (start === -1) {
      if (char === "{") {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function isMetricType(value: unknown, enabledMetricTypes: ReadonlySet<string>): value is WeeklyMissionMetricType {
  return typeof value === "string" && enabledMetricTypes.has(value);
}

function normalizeSourceFeatures(raw: unknown[]): WeeklyMissionSourceFeature[] | null {
  const result: WeeklyMissionSourceFeature[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !SOURCE_FEATURES.has(item as WeeklyMissionSourceFeature)) {
      return null;
    }
    result.push(item as WeeklyMissionSourceFeature);
  }
  return result.length > 0 && result.length <= 3 ? result : null;
}

function normalizeWeaknessTarget(raw: unknown): WeeklyMission["weaknessTarget"] | null | false {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return false;
  const category = readString(raw, "category", 80);
  const label = readString(raw, "label", 120);
  if (!category || !label) return false;
  const practiceFocus =
    typeof raw.practiceFocus === "string" && raw.practiceFocus.trim()
      ? raw.practiceFocus.trim().slice(0, 240)
      : undefined;
  return { category, label, practiceFocus };
}

function normalizeRecommendedAction(raw: unknown): WeeklyMission["recommendedAction"] | null {
  if (!isRecord(raw)) return null;
  const label = readString(raw, "label", 80);
  const routeTarget = raw.routeTarget;
  if (!label || typeof routeTarget !== "string" || !ROUTE_TARGETS.has(routeTarget as WeeklyMissionRouteTarget)) {
    return null;
  }
  return { label, routeTarget: routeTarget as WeeklyMissionRouteTarget };
}

export function buildWeeklyMissionAiInput(input: {
  weekStart: string;
  weekEnd: string;
  enabledMetricTypes: WeeklyMissionMetricType[];
  dataSufficiency: WeeklyMissionDataSufficiency;
  sourceSnapshot: WeeklyMissionSourceSnapshot;
  userLevel?: string | null;
}): WeeklyMissionAiInput {
  return {
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    enabledMetricTypes: input.enabledMetricTypes,
    dataSufficiency: input.dataSufficiency,
    sourceCounts: {
      podchatSessions: input.sourceSnapshot.podchatSessions,
      patternDrillSessions: input.sourceSnapshot.patternDrillSessions,
      vocabularyCollected: input.sourceSnapshot.vocabularyCollected,
      vocabularySentencesSubmitted: input.sourceSnapshot.vocabularySentencesSubmitted,
      vocabularyCorrectionsSaved: input.sourceSnapshot.vocabularyCorrectionsSaved,
      articlePracticeCompleted: input.sourceSnapshot.articlePracticeCompleted,
      repeatedWeaknessCount: input.sourceSnapshot.repeatedWeaknessCount,
    },
    speakingMinutes: input.sourceSnapshot.speakingMinutes,
    activeDays: input.sourceSnapshot.activeDays.slice(0, 7),
    topWeaknesses: input.sourceSnapshot.topWeaknesses.slice(0, 5),
    priorIncompleteMissions: [],
    userLevel: input.userLevel?.trim() || undefined,
  };
}

export function classifySnapshotDataSufficiency(
  sourceSnapshot: WeeklyMissionSourceSnapshot,
): WeeklyMissionDataSufficiency {
  return classifyWeeklyMissionDataSufficiency({
    completedPodchatSessions: sourceSnapshot.podchatSessions,
    speakingMinutes: sourceSnapshot.speakingMinutes,
    activeDays: sourceSnapshot.activeDays.length,
    vocabularyItemsCollected: sourceSnapshot.vocabularyCollected,
    articlePracticeCompleted: sourceSnapshot.articlePracticeCompleted,
    patternDrillSessionsCompleted: sourceSnapshot.patternDrillSessions,
    repeatedWeaknessCount: sourceSnapshot.repeatedWeaknessCount,
  });
}

export function buildWeeklyMissionSystemPrompt(): string {
  return [
    "You generate Weekly Mission plans for an academic English speaking app.",
    "Return ONLY one raw JSON object. No markdown, no code fences, no commentary.",
    "You may diagnose and propose missions, but you must not invent progress.",
    "Use only the enabledMetricTypes provided in the user JSON.",
    "Generate exactly 3 to 5 measurable missions.",
    "Do not include currentValue, status, missionId, ownerId, provider, source snapshots, raw transcripts, raw answers, prompts, or model details.",
    "If dataSufficiency is starter, create starter missions instead of pretending there is a detailed diagnosis.",
    "Each mission must include title, description, reason, weaknessTarget or null, metricType, targetValue, unit, sourceFeatures, and recommendedAction.",
  ].join("\n");
}

export function buildWeeklyMissionUserPrompt(input: WeeklyMissionAiInput): string {
  return [
    "Create a Weekly Mission Review from this bounded deterministic data:",
    JSON.stringify(input),
    "",
    "Required JSON shape:",
    JSON.stringify({
      diagnosisSummary: "short summary",
      dataSufficiency: input.dataSufficiency,
      topWeaknesses: [{ category: "Grammar", label: "Example", reason: "short reason" }],
      missions: [
        {
          title: "mission title",
          description: "mission description",
          reason: "why this mission helps",
          weaknessTarget: null,
          metricType: input.enabledMetricTypes[0],
          targetValue: 3,
          unit: "sessions",
          sourceFeatures: ["podchat"],
          recommendedAction: { label: "Start practice", routeTarget: "podchat" },
        },
      ],
    }),
  ].join("\n");
}

export function parseWeeklyMissionAiOutput(
  raw: string,
  enabledMetricTypes: WeeklyMissionMetricType[],
): WeeklyMissionAiOutput | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || hasForbiddenKey(parsed)) return null;
  const diagnosisSummary = readString(parsed, "diagnosisSummary", 700);
  if (!diagnosisSummary) return null;
  if (typeof parsed.dataSufficiency !== "string" || !DATA_SUFFICIENCY_VALUES.has(parsed.dataSufficiency)) {
    return null;
  }

  const rawMissions = parsed.missions;
  if (!Array.isArray(rawMissions) || rawMissions.length < 3 || rawMissions.length > 5) {
    return null;
  }

  const enabled = new Set(enabledMetricTypes);
  const missions: ProposedMission[] = [];
  for (const rawMission of rawMissions) {
    if (!isRecord(rawMission) || hasForbiddenKey(rawMission)) return null;
    const title = readString(rawMission, "title", 100);
    const description = readString(rawMission, "description", 260);
    const reason = readString(rawMission, "reason", 260);
    const metricType = rawMission.metricType;
    const targetValue = rawMission.targetValue;
    const unit = readString(rawMission, "unit", 40);
    const weaknessTarget = normalizeWeaknessTarget(rawMission.weaknessTarget);
    const sourceFeatures = Array.isArray(rawMission.sourceFeatures)
      ? normalizeSourceFeatures(rawMission.sourceFeatures)
      : null;
    const recommendedAction = normalizeRecommendedAction(rawMission.recommendedAction);

    if (
      !title ||
      !description ||
      !reason ||
      !isMetricType(metricType, enabled) ||
      typeof targetValue !== "number" ||
      !Number.isFinite(targetValue) ||
      !unit ||
      weaknessTarget === false ||
      !sourceFeatures ||
      !recommendedAction
    ) {
      return null;
    }

    missions.push({
      title,
      description,
      reason,
      weaknessTarget,
      metricType,
      targetValue,
      unit,
      sourceFeatures,
      recommendedAction,
    });
  }

  const topWeaknesses = Array.isArray(parsed.topWeaknesses)
    ? parsed.topWeaknesses.slice(0, 5).flatMap((item) => {
        if (!isRecord(item)) return [];
        const category = readString(item, "category", 80);
        const label = readString(item, "label", 120);
        const reason = readString(item, "reason", 220);
        return category && label && reason ? [{ category, label, reason }] : [];
      })
    : [];

  return {
    diagnosisSummary,
    dataSufficiency: parsed.dataSufficiency as WeeklyMissionDataSufficiency,
    topWeaknesses,
    missions,
  };
}

function routeForMetric(metricType: WeeklyMissionMetricType): {
  sourceFeatures: WeeklyMissionSourceFeature[];
  recommendedAction: WeeklyMission["recommendedAction"];
  unit: string;
} {
  switch (metricType) {
    case "speaking_minutes":
      return { sourceFeatures: ["podchat"], recommendedAction: { label: "Start Podchat", routeTarget: "podchat" }, unit: "minutes" };
    case "podchat_sessions":
      return { sourceFeatures: ["podchat"], recommendedAction: { label: "Start Podchat", routeTarget: "podchat" }, unit: "sessions" };
    case "pattern_drill_sessions":
      return { sourceFeatures: ["pattern_drill"], recommendedAction: { label: "Open Pattern Drill", routeTarget: "pattern_drill" }, unit: "sessions" };
    case "vocabulary_collected":
      return { sourceFeatures: ["vocabulary"], recommendedAction: { label: "Open Vocabulary", routeTarget: "vocabulary" }, unit: "items" };
    case "vocab_sentence_submitted":
      return { sourceFeatures: ["vocabulary"], recommendedAction: { label: "Practice Vocabulary", routeTarget: "vocabulary" }, unit: "sentences" };
    case "vocab_correction_saved":
      return { sourceFeatures: ["vocabulary"], recommendedAction: { label: "Check Corrections", routeTarget: "vocabulary" }, unit: "corrections" };
    case "article_practice_completed":
      return { sourceFeatures: ["article_practice"], recommendedAction: { label: "Start Article Practice", routeTarget: "article_practice" }, unit: "sessions" };
    case "daily_practice_days":
      return { sourceFeatures: ["podchat", "vocabulary", "article_practice"], recommendedAction: { label: "Practice Today", routeTarget: "podchat" }, unit: "days" };
    case "vocabulary_reviewed":
    case "weakness_resolution":
      return { sourceFeatures: ["vocabulary"], recommendedAction: { label: "Practice", routeTarget: "vocabulary" }, unit: "items" };
  }
}

function fallbackMission(metricType: WeeklyMissionMetricType, targetValue: number, title: string, description: string, reason: string, weaknessTarget: WeeklyMission["weaknessTarget"] = null): ProposedMission {
  const route = routeForMetric(metricType);
  return {
    title,
    description,
    reason,
    weaknessTarget,
    metricType,
    targetValue,
    unit: route.unit,
    sourceFeatures: route.sourceFeatures,
    recommendedAction: route.recommendedAction,
  };
}

function addFallbackMission(missions: ProposedMission[], mission: ProposedMission): void {
  if (missions.length >= 5 || missions.some((existing) => existing.metricType === mission.metricType)) return;
  missions.push(mission);
}

export function buildFallbackWeeklyMissionOutput(input: {
  dataSufficiency: WeeklyMissionDataSufficiency;
  sourceSnapshot: WeeklyMissionSourceSnapshot;
}): WeeklyMissionAiOutput {
  const snapshot = input.sourceSnapshot;
  const topWeakness = input.sourceSnapshot.topWeaknesses[0];
  const weaknessTarget = topWeakness
    ? { category: topWeakness.category, label: topWeakness.label, practiceFocus: topWeakness.practiceFocus }
    : null;
  const lowSpeakingActivity = snapshot.speakingMinutes < 30 || snapshot.podchatSessions < 2;
  const vocabularyGap = snapshot.vocabularyCollected < 10;
  const articleGap = snapshot.articlePracticeCompleted < 1;
  const missions: ProposedMission[] = [];

  if (input.dataSufficiency === "starter") {
    addFallbackMission(missions, fallbackMission("podchat_sessions", 1, "Complete a baseline Podchat", "Finish one evaluated Podchat session to create a speaking baseline.", "Start with a real speaking sample before diagnosing patterns."));
    addFallbackMission(missions, fallbackMission("speaking_minutes", 15, "Log starter speaking minutes", "Reach 15 minutes of saved speaking practice this week.", "A small speaking target creates the first fluency signal."));
    addFallbackMission(missions, fallbackMission("vocabulary_collected", 5, "Collect starter vocabulary", "Save five vocabulary items from practice or article work.", "A starter word bank gives future reviews useful material."));
    addFallbackMission(missions, fallbackMission("daily_practice_days", 2, "Practice on two days", "Complete any tracked practice activity on two different UTC days.", "Two practice days establish a measurable weekly rhythm."));
  } else if (input.dataSufficiency === "partial") {
    if (lowSpeakingActivity) {
      addFallbackMission(missions, fallbackMission("speaking_minutes", 30, "Raise speaking volume", "Reach 30 saved speaking minutes this week.", "Speaking volume is still low, so more evaluated practice will improve future feedback."));
      addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "Add Podchat evidence", "Complete two evaluated Podchat sessions this week.", "More sessions make weekly progress less dependent on a single sample."));
    } else {
      addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "Keep Podchat rhythm", "Complete two evaluated Podchat sessions this week.", "Maintain the speaking evidence you already started building."));
      addFallbackMission(missions, fallbackMission("speaking_minutes", 45, "Extend speaking transfer", "Reach 45 saved speaking minutes this week.", "Longer speaking practice helps turn feedback into fluent use."));
    }
    if (vocabularyGap) {
      addFallbackMission(missions, fallbackMission("vocabulary_collected", 10, "Fill the vocabulary gap", "Save ten useful vocabulary items from practice or article work.", "Vocabulary activity is low, so collecting words will make review more useful."));
    }
    if (articleGap) {
      addFallbackMission(missions, fallbackMission("article_practice_completed", 1, "Add one article practice", "Complete one evaluated Article Practice session.", "Article work adds structured academic writing evidence."));
    }
    if (topWeakness) {
      addFallbackMission(missions, fallbackMission("pattern_drill_sessions", 1, "Drill your clearest pattern", "Complete one Pattern Drill focused on the strongest current weakness signal.", "A real weakness signal is available, so targeted practice can be useful.", weaknessTarget));
    }
    addFallbackMission(missions, fallbackMission("daily_practice_days", 3, "Practice on three days", "Complete any tracked practice activity on three different UTC days.", "Spacing practice across the week improves retention."));
  } else {
    if (topWeakness) {
      addFallbackMission(missions, fallbackMission("pattern_drill_sessions", 1, "Drill your top weakness", "Complete one Pattern Drill focused on this week's repeated weakness.", "Targeted pattern practice turns repeated feedback into repeatable control.", weaknessTarget));
    }
    addFallbackMission(missions, fallbackMission("speaking_minutes", 45, "Transfer feedback into speaking", "Reach 45 saved speaking minutes this week.", "Strong data is most useful when you transfer it back into live speaking.", weaknessTarget));
    if (vocabularyGap) {
      addFallbackMission(missions, fallbackMission("vocabulary_collected", 10, "Build vocabulary for transfer", "Save ten vocabulary items that support this week's speaking work.", "Vocabulary is the clearest gap in an otherwise stronger practice record."));
    } else {
      addFallbackMission(missions, fallbackMission("vocab_sentence_submitted", 3, "Use vocabulary in sentences", "Submit three vocabulary practice sentences.", "Sentence practice turns known words into usable academic phrasing."));
    }
    if (articleGap) {
      addFallbackMission(missions, fallbackMission("article_practice_completed", 1, "Add article transfer practice", "Complete one evaluated Article Practice session.", "Article work adds a transfer surface beyond speaking."));
    } else {
      addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "Keep Podchat transfer active", "Complete two evaluated Podchat sessions this week.", "A second transfer mission keeps the week grounded in live speaking."));
    }
    addFallbackMission(missions, fallbackMission("daily_practice_days", 4, "Sustain four practice days", "Complete any tracked practice activity on four different UTC days.", "Strong evidence supports a higher consistency target."));
  }

  addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "Complete two Podchat sessions", "Finish two evaluated speaking sessions this week.", "Build steady speaking rhythm with saved evaluated practice."));
  addFallbackMission(missions, fallbackMission("speaking_minutes", 30, "Reach 30 speaking minutes", "Accumulate 30 minutes of saved speaking practice.", "More speaking time creates more reliable fluency evidence."));
  addFallbackMission(missions, fallbackMission("vocabulary_collected", 10, "Collect ten useful vocabulary items", "Save ten vocabulary items from practice or article work.", "A small vocabulary collection gives the week concrete review material."));
  addFallbackMission(missions, fallbackMission("article_practice_completed", 1, "Complete one Article Practice", "Finish one evaluated article writing practice.", "Article work strengthens structured academic responses."));
  addFallbackMission(missions, fallbackMission("daily_practice_days", 3, "Practice on three days", "Complete any tracked practice activity on three different UTC days.", "Spacing practice across the week improves retention."));

  return {
    diagnosisSummary:
      input.dataSufficiency === "starter"
        ? "Start this week with baseline practice across speaking, vocabulary, and daily rhythm."
        : input.dataSufficiency === "partial"
          ? `This week should increase useful practice evidence${topWeakness ? ` while lightly targeting ${topWeakness.label}` : ""}.`
          : `This week should transfer strong practice data into focused speaking${topWeakness ? ` and ${topWeakness.label}` : ""}.`,
    dataSufficiency: input.dataSufficiency,
    topWeaknesses: input.dataSufficiency !== "starter" && topWeakness
      ? [{ category: topWeakness.category, label: topWeakness.label, reason: "This pattern appeared in the bounded weekly activity snapshot." }]
      : [],
    missions,
  };
}

export function finalizeWeeklyMissions(input: FinalizeWeeklyMissionsInput): WeeklyMission[] {
  const enabled = new Set(input.enabledMetricTypes);
  const missions = input.proposedOutput.missions.slice(0, 5).map((mission, index) => {
    const metricType = enabled.has(mission.metricType) ? mission.metricType : "podchat_sessions";
    const target = validateWeeklyMissionTarget({
      metricType,
      proposedTargetValue: mission.targetValue,
    });
    const currentValue = 0;
    const route = routeForMetric(metricType);
    return {
      missionId: createWeeklyMissionId({
        ownerId: input.ownerId,
        weekStart: input.weekStart,
        metricType,
        index,
      }),
      title: mission.title,
      description: mission.description,
      reason: mission.reason,
      weaknessTarget: mission.weaknessTarget,
      metricType,
      targetValue: target.targetValue,
      currentValue,
      unit: mission.unit || route.unit,
      sourceFeatures: mission.sourceFeatures.length > 0 ? mission.sourceFeatures : route.sourceFeatures,
      status: deriveWeeklyMissionStatus({
        currentValue,
        targetValue: target.targetValue,
        now: input.now,
        weekEnd: input.weekEnd,
      }),
      recommendedAction: ROUTE_TARGETS.has(mission.recommendedAction.routeTarget)
        ? mission.recommendedAction
        : route.recommendedAction,
      createdAt: input.createdAt,
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
    };
  });

  return missions;
}

export function deriveWeeklyMissionReviewStatus(input: {
  missions: WeeklyMission[];
  now: Date;
  weekEnd: string;
}): WeeklyMissionReviewStatus {
  if (input.missions.length > 0 && input.missions.every((mission) => mission.status === "completed")) {
    return "completed";
  }
  const weekEnd = new Date(`${input.weekEnd}T23:59:59.999Z`);
  if (Number.isFinite(weekEnd.getTime()) && input.now.getTime() > weekEnd.getTime()) {
    return "expired";
  }
  return "active";
}
