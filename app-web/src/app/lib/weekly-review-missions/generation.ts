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

export type WeeklyMissionAnalyticOutput = {
  diagnosisSummary: string;
  dataSufficiencyComment: string;
  primaryWeaknesses: Array<{
    category: string;
    label: string;
    reason: string;
    practiceFocus?: string;
  }>;
  learningPriority: string;
  recommendedMissionStrategy: string;
};

export type WeeklyMissionTitleKey =
  | "complete_speaking_minutes"
  | "complete_podchat_sessions"
  | "collect_vocabulary_items"
  | "submit_vocabulary_sentences"
  | "save_vocabulary_corrections"
  | "complete_article_practice_sessions"
  | "practice_on_distinct_days";

export type WeeklyMissionDescriptionKey =
  | "build_speaking_volume"
  | "add_evaluated_speaking_samples"
  | "target_repeated_weakness"
  | "build_active_vocabulary"
  | "apply_vocabulary_in_sentences"
  | "save_revised_language"
  | "practice_article_transfer"
  | "build_weekly_rhythm";

type ProposedMission = {
  missionIntent: string;
  titleKey: WeeklyMissionTitleKey;
  descriptionKey: WeeklyMissionDescriptionKey;
  reason: string;
  weaknessTarget: WeeklyMission["weaknessTarget"];
  metricType: WeeklyMissionMetricType;
  proposedTargetValue: number;
  unit: string;
  sourceFeatures: WeeklyMissionSourceFeature[];
  recommendedAction: WeeklyMission["recommendedAction"];
};

export type WeeklyMissionPlanningOutput = {
  missions: ProposedMission[];
};

export type WeeklyMissionAiOutput = WeeklyMissionPlanningOutput & {
  diagnosisSummary: string;
  dataSufficiency: WeeklyMissionDataSufficiency;
  topWeaknesses: WeeklyMissionAnalyticOutput["primaryWeaknesses"];
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

const ROUTE_TARGETS = new Set<WeeklyMissionRouteTarget>([
  "podchat",
  "vocabulary",
  "article_practice",
  "commonplace",
]);
const SOURCE_FEATURES = new Set<WeeklyMissionSourceFeature>([
  "podchat",
  "vocabulary",
  "article_practice",
  "commonplace",
]);
const FORBIDDEN_OUTPUT_KEYS = new Set([
  "currentvalue",
  "current_value",
  "completioncount",
  "completioncounts",
  "completion_count",
  "completion_counts",
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

const TITLE_KEY_BY_METRIC: Record<WeeklyMissionMetricType, WeeklyMissionTitleKey | null> = {
  speaking_minutes: "complete_speaking_minutes",
  podchat_sessions: "complete_podchat_sessions",
  vocabulary_collected: "collect_vocabulary_items",
  vocabulary_reviewed: null,
  vocab_sentence_submitted: "submit_vocabulary_sentences",
  vocab_correction_saved: "save_vocabulary_corrections",
  article_practice_completed: "complete_article_practice_sessions",
  daily_practice_days: "practice_on_distinct_days",
  weakness_resolution: null,
  listening_exercise_sessions: null,
};

const DESCRIPTION_KEY_BY_METRIC: Record<WeeklyMissionMetricType, WeeklyMissionDescriptionKey | null> = {
  speaking_minutes: "build_speaking_volume",
  podchat_sessions: "add_evaluated_speaking_samples",
  vocabulary_collected: "build_active_vocabulary",
  vocabulary_reviewed: null,
  vocab_sentence_submitted: "apply_vocabulary_in_sentences",
  vocab_correction_saved: "save_revised_language",
  article_practice_completed: "practice_article_transfer",
  daily_practice_days: "build_weekly_rhythm",
  weakness_resolution: null,
  listening_exercise_sessions: null,
};

const TITLE_KEYS = new Set<WeeklyMissionTitleKey>(
  Object.values(TITLE_KEY_BY_METRIC).filter((key): key is WeeklyMissionTitleKey => Boolean(key)),
);
const DESCRIPTION_KEYS = new Set<WeeklyMissionDescriptionKey>(
  Object.values(DESCRIPTION_KEY_BY_METRIC).filter((key): key is WeeklyMissionDescriptionKey => Boolean(key)),
);

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

function normalizeTitleKey(raw: unknown, metricType: WeeklyMissionMetricType): WeeklyMissionTitleKey | null {
  if (typeof raw !== "string" || !TITLE_KEYS.has(raw as WeeklyMissionTitleKey)) return null;
  return TITLE_KEY_BY_METRIC[metricType] === raw ? raw as WeeklyMissionTitleKey : null;
}

function normalizeDescriptionKey(raw: unknown, metricType: WeeklyMissionMetricType): WeeklyMissionDescriptionKey | null {
  if (typeof raw !== "string" || !DESCRIPTION_KEYS.has(raw as WeeklyMissionDescriptionKey)) return null;
  return DESCRIPTION_KEY_BY_METRIC[metricType] === raw ? raw as WeeklyMissionDescriptionKey : null;
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
  const routeTarget = raw.routeTarget;
  if (typeof routeTarget !== "string" || !ROUTE_TARGETS.has(routeTarget as WeeklyMissionRouteTarget)) {
    return null;
  }
  return { label: labelForRouteTarget(routeTarget as WeeklyMissionRouteTarget), routeTarget: routeTarget as WeeklyMissionRouteTarget };
}

function hasNumericProgressClaim(value: string): boolean {
  return /\d/.test(value);
}

function labelForRouteTarget(routeTarget: WeeklyMissionRouteTarget): string {
  switch (routeTarget) {
    case "podchat":
      return "Start Podchat";
    case "vocabulary":
      return "Open Vocabulary";
    case "article_practice":
      return "Start Article Practice";
    case "commonplace":
      return "Open Commonplace";
  }
}

function defaultReasonForMetric(
  metricType: WeeklyMissionMetricType,
  weaknessTarget: WeeklyMission["weaknessTarget"],
): string {
  switch (metricType) {
    case "speaking_minutes":
      return "Speaking volume helps turn feedback into more fluent academic responses.";
    case "podchat_sessions":
      return "Evaluated speaking sessions create reliable evidence for future feedback.";
    case "vocabulary_collected":
      return "Useful vocabulary gives the week concrete material for review and transfer.";
    case "vocab_sentence_submitted":
      return "Sentence practice turns saved vocabulary into usable academic phrasing.";
    case "vocab_correction_saved":
      return "Saved corrections help revised language become reusable in later practice.";
    case "article_practice_completed":
      return "Article practice adds structured academic transfer beyond live speaking.";
    case "daily_practice_days":
      return "Spacing practice across the week builds a steadier learning rhythm.";
    case "vocabulary_reviewed":
    case "weakness_resolution":
    case "listening_exercise_sessions":
      return "This mission supports focused weekly practice from tracked activity.";
  }
}

function sanitizeMissionReason(
  reason: string,
  metricType: WeeklyMissionMetricType,
  weaknessTarget: WeeklyMission["weaknessTarget"],
): string {
  return hasNumericProgressClaim(reason)
    ? defaultReasonForMetric(metricType, weaknessTarget)
    : reason;
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
    repeatedWeaknessCount: sourceSnapshot.repeatedWeaknessCount,
  });
}

export function buildWeeklyMissionAnalyticSystemPrompt(): string {
  return [
    "You analyze bounded weekly learning signals for an academic English speaking app.",
    "Return ONLY one raw JSON object. No markdown, no code fences, no commentary.",
    "Do not propose mission progress, target counts, completion counts, statuses, owner IDs, provider names, model names, source snapshots, raw transcripts, raw answers, prompts, or private data.",
    "If dataSufficiency is starter, say that the plan should build baseline evidence instead of inventing a weakness diagnosis.",
    "Keep every field short and safe for storage.",
  ].join("\n");
}

export function buildWeeklyMissionAnalyticUserPrompt(input: WeeklyMissionAiInput): string {
  return [
    "Analyze this bounded deterministic data:",
    JSON.stringify(input),
    "",
    "Required JSON shape:",
    JSON.stringify({
      diagnosisSummary: "short summary",
      dataSufficiencyComment: "short comment about signal quality",
      primaryWeaknesses: [
        {
          category: "Grammar",
          label: "Example",
          reason: "short reason without numbers",
          practiceFocus: "optional short focus",
        },
      ],
      learningPriority: "short priority",
      recommendedMissionStrategy: "short strategy",
    }),
  ].join("\n");
}

export function buildWeeklyMissionPlanningSystemPrompt(): string {
  return [
    "You propose Weekly Mission intents for an academic English speaking app.",
    "Return ONLY one raw JSON object. No markdown, no code fences, no commentary.",
    "Use only enabled metrics and the allowed server text keys provided in the user prompt.",
    "Generate exactly 3 to 5 measurable missions.",
    "Do not include currentValue, status, missionId, ownerId, provider, source snapshots, raw transcripts, raw answers, prompts, model details, or progress claims.",
    "Mission reasons must not mention target numbers, current progress, completion counts, or mission status.",
    "The server will clamp targets, write final titles/descriptions, derive CTA labels, and compute progress.",
  ].join("\n");
}

export function buildWeeklyMissionPlanningUserPrompt(input: {
  aiInput: WeeklyMissionAiInput;
  analyticOutput: WeeklyMissionAnalyticOutput;
}): string {
  return [
    "Create mission proposals from this bounded data and analytic summary.",
    "Bounded data:",
    JSON.stringify(input.aiInput),
    "Analytic summary:",
    JSON.stringify(input.analyticOutput),
    "",
    "Allowed title keys by metric:",
    JSON.stringify(TITLE_KEY_BY_METRIC),
    "Allowed description keys by metric:",
    JSON.stringify(DESCRIPTION_KEY_BY_METRIC),
    "",
    "Required JSON shape:",
    JSON.stringify({
      missions: [
        {
          missionIntent: "short intent",
          titleKey: TITLE_KEY_BY_METRIC[input.aiInput.enabledMetricTypes[0]] ?? "complete_podchat_sessions",
          descriptionKey: DESCRIPTION_KEY_BY_METRIC[input.aiInput.enabledMetricTypes[0]] ?? "add_evaluated_speaking_samples",
          metricType: input.aiInput.enabledMetricTypes[0],
          proposedTargetValue: 3,
          unit: "sessions",
          reason: "why this mission helps without numbers",
          weaknessTarget: null,
          sourceFeatures: ["podchat"],
          recommendedAction: { label: "ignored by server", routeTarget: "podchat" },
        },
      ],
    }),
  ].join("\n");
}

export function parseWeeklyMissionAnalyticOutput(raw: string): WeeklyMissionAnalyticOutput | null {
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
  const dataSufficiencyComment = readString(parsed, "dataSufficiencyComment", 240);
  const learningPriority = readString(parsed, "learningPriority", 240);
  const recommendedMissionStrategy = readString(parsed, "recommendedMissionStrategy", 240);
  if (!diagnosisSummary || !dataSufficiencyComment || !learningPriority || !recommendedMissionStrategy) {
    return null;
  }

  const rawWeaknesses = parsed.primaryWeaknesses;
  if (!Array.isArray(rawWeaknesses)) return null;
  const primaryWeaknesses = rawWeaknesses.slice(0, 5).flatMap((item) => {
    if (!isRecord(item) || hasForbiddenKey(item)) return [];
    const category = readString(item, "category", 80);
    const label = readString(item, "label", 120);
    const reason = readString(item, "reason", 220);
    if (!category || !label || !reason || hasNumericProgressClaim(reason)) return [];
    const practiceFocus = readString(item, "practiceFocus", 240) ?? undefined;
    return [{ category, label, reason, practiceFocus }];
  });

  return {
    diagnosisSummary,
    dataSufficiencyComment,
    primaryWeaknesses,
    learningPriority,
    recommendedMissionStrategy,
  };
}

export function parseWeeklyMissionPlanningOutput(
  raw: string,
  enabledMetricTypes: WeeklyMissionMetricType[],
): WeeklyMissionPlanningOutput | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || hasForbiddenKey(parsed)) return null;

  const rawMissions = parsed.missions;
  if (!Array.isArray(rawMissions) || rawMissions.length < 3 || rawMissions.length > 5) {
    return null;
  }

  const enabled = new Set(enabledMetricTypes);
  const missions: ProposedMission[] = [];
  for (const rawMission of rawMissions) {
    if (!isRecord(rawMission) || hasForbiddenKey(rawMission)) return null;
    const missionIntent = readString(rawMission, "missionIntent", 160);
    const reason = readString(rawMission, "reason", 260);
    const metricType = rawMission.metricType;
    if (!isMetricType(metricType, enabled)) return null;
    const titleKey = normalizeTitleKey(rawMission.titleKey, metricType);
    const descriptionKey = normalizeDescriptionKey(rawMission.descriptionKey, metricType);
    const proposedTargetValue = rawMission.proposedTargetValue;
    const unit = readString(rawMission, "unit", 40);
    const weaknessTarget = normalizeWeaknessTarget(rawMission.weaknessTarget);
    const sourceFeatures = Array.isArray(rawMission.sourceFeatures)
      ? normalizeSourceFeatures(rawMission.sourceFeatures)
      : null;
    const recommendedAction = normalizeRecommendedAction(rawMission.recommendedAction);
    const route = routeForMetric(metricType);

    if (
      !missionIntent ||
      !titleKey ||
      !descriptionKey ||
      !reason ||
      typeof proposedTargetValue !== "number" ||
      !Number.isFinite(proposedTargetValue) ||
      !unit ||
      weaknessTarget === false ||
      !sourceFeatures ||
      !recommendedAction ||
      recommendedAction.routeTarget !== route.recommendedAction.routeTarget
    ) {
      return null;
    }

    missions.push({
      missionIntent,
      titleKey,
      descriptionKey,
      reason,
      weaknessTarget,
      metricType,
      proposedTargetValue,
      unit,
      sourceFeatures,
      recommendedAction,
    });
  }

  return { missions };
}

export function buildWeeklyMissionOutputFromPlanning(input: {
  analyticOutput: WeeklyMissionAnalyticOutput;
  planningOutput: WeeklyMissionPlanningOutput;
  dataSufficiency: WeeklyMissionDataSufficiency;
}): WeeklyMissionAiOutput {
  return {
    diagnosisSummary: input.analyticOutput.diagnosisSummary,
    dataSufficiency: input.dataSufficiency,
    topWeaknesses: input.analyticOutput.primaryWeaknesses,
    missions: input.planningOutput.missions,
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
    case "listening_exercise_sessions":
      return { sourceFeatures: ["podchat"], recommendedAction: { label: "Start Podchat", routeTarget: "podchat" }, unit: "sessions" };
  }
}

function renderWeeklyMissionTitle(input: {
  titleKey: WeeklyMissionTitleKey;
  targetValue: number;
}): string {
  switch (input.titleKey) {
    case "complete_speaking_minutes":
      return `Reach ${input.targetValue} speaking minutes`;
    case "complete_podchat_sessions":
      return `Complete ${input.targetValue} Podchat ${input.targetValue === 1 ? "session" : "sessions"}`;
    case "collect_vocabulary_items":
      return `Collect ${input.targetValue} vocabulary items`;
    case "submit_vocabulary_sentences":
      return `Submit ${input.targetValue} vocabulary ${input.targetValue === 1 ? "sentence" : "sentences"}`;
    case "save_vocabulary_corrections":
      return `Save ${input.targetValue} vocabulary ${input.targetValue === 1 ? "correction" : "corrections"}`;
    case "complete_article_practice_sessions":
      return `Complete ${input.targetValue} Article Practice ${input.targetValue === 1 ? "session" : "sessions"}`;
    case "practice_on_distinct_days":
      return `Practice on ${input.targetValue} ${input.targetValue === 1 ? "day" : "days"}`;
  }
}

function renderWeeklyMissionDescription(input: {
  descriptionKey: WeeklyMissionDescriptionKey;
  targetValue: number;
}): string {
  switch (input.descriptionKey) {
    case "build_speaking_volume":
      return `Reach ${input.targetValue} saved speaking minutes this week.`;
    case "add_evaluated_speaking_samples":
      return `Complete ${input.targetValue} evaluated Podchat ${input.targetValue === 1 ? "session" : "sessions"} this week.`;
    case "target_repeated_weakness":
      return `Complete ${input.targetValue} Drill Mode ${input.targetValue === 1 ? "session" : "sessions"} focused on the strongest current weakness signal.`;
    case "build_active_vocabulary":
      return `Save ${input.targetValue} useful vocabulary items from practice or article work.`;
    case "apply_vocabulary_in_sentences":
      return `Submit ${input.targetValue} vocabulary practice ${input.targetValue === 1 ? "sentence" : "sentences"}.`;
    case "save_revised_language":
      return `Save ${input.targetValue} vocabulary ${input.targetValue === 1 ? "correction" : "corrections"} or revisions.`;
    case "practice_article_transfer":
      return `Complete ${input.targetValue} evaluated Article Practice ${input.targetValue === 1 ? "session" : "sessions"}.`;
    case "build_weekly_rhythm":
      return `Complete tracked practice activity on ${input.targetValue} different UTC ${input.targetValue === 1 ? "day" : "days"}.`;
  }
}

function fallbackMission(metricType: WeeklyMissionMetricType, targetValue: number, reason: string, weaknessTarget: WeeklyMission["weaknessTarget"] = null): ProposedMission {
  const route = routeForMetric(metricType);
  const titleKey = TITLE_KEY_BY_METRIC[metricType] ?? "complete_podchat_sessions";
  const descriptionKey = DESCRIPTION_KEY_BY_METRIC[metricType] ?? "add_evaluated_speaking_samples";
  return {
    missionIntent: defaultReasonForMetric(metricType, weaknessTarget),
    titleKey,
    descriptionKey,
    reason,
    weaknessTarget,
    metricType,
    proposedTargetValue: targetValue,
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
    addFallbackMission(missions, fallbackMission("podchat_sessions", 1, "Start with a real speaking sample before diagnosing patterns."));
    addFallbackMission(missions, fallbackMission("speaking_minutes", 15, "A small speaking target creates the first fluency signal."));
    addFallbackMission(missions, fallbackMission("vocabulary_collected", 5, "A starter word bank gives future reviews useful material."));
    addFallbackMission(missions, fallbackMission("daily_practice_days", 2, "Practice spacing establishes a measurable weekly rhythm."));
  } else if (input.dataSufficiency === "partial") {
    if (lowSpeakingActivity) {
      addFallbackMission(missions, fallbackMission("speaking_minutes", 30, "Speaking volume is still low, so more evaluated practice will improve future feedback."));
      addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "More sessions make weekly progress less dependent on a single sample."));
    } else {
      addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "Maintain the speaking evidence you already started building."));
      addFallbackMission(missions, fallbackMission("speaking_minutes", 45, "Longer speaking practice helps turn feedback into fluent use."));
    }
    if (vocabularyGap) {
      addFallbackMission(missions, fallbackMission("vocabulary_collected", 10, "Vocabulary activity is low, so collecting words will make review more useful."));
    }
    if (articleGap) {
      addFallbackMission(missions, fallbackMission("article_practice_completed", 1, "Article work adds structured academic writing evidence."));
    }
    if (topWeakness) {
      addFallbackMission(missions, fallbackMission("vocab_correction_saved", 1, "A real weakness signal is available, so targeted practice can be useful.", weaknessTarget));
    }
    addFallbackMission(missions, fallbackMission("daily_practice_days", 3, "Spacing practice across the week improves retention."));
  } else {
    if (topWeakness) {
      addFallbackMission(missions, fallbackMission("vocab_correction_saved", 1, "Targeted pattern practice turns repeated feedback into repeatable control.", weaknessTarget));
    }
    addFallbackMission(missions, fallbackMission("speaking_minutes", 45, "Strong data is most useful when you transfer it back into live speaking.", weaknessTarget));
    if (vocabularyGap) {
      addFallbackMission(missions, fallbackMission("vocabulary_collected", 10, "Vocabulary is the clearest gap in an otherwise stronger practice record."));
    } else {
      addFallbackMission(missions, fallbackMission("vocab_sentence_submitted", 3, "Sentence practice turns known words into usable academic phrasing."));
    }
    if (articleGap) {
      addFallbackMission(missions, fallbackMission("article_practice_completed", 1, "Article work adds a transfer surface beyond speaking."));
    } else {
      addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "An additional transfer mission keeps the week grounded in live speaking."));
    }
    addFallbackMission(missions, fallbackMission("daily_practice_days", 4, "Strong evidence supports a higher consistency target."));
  }

  addFallbackMission(missions, fallbackMission("podchat_sessions", 2, "Build steady speaking rhythm with saved evaluated practice."));
  addFallbackMission(missions, fallbackMission("speaking_minutes", 30, "More speaking time creates more reliable fluency evidence."));
  addFallbackMission(missions, fallbackMission("vocabulary_collected", 10, "A small vocabulary collection gives the week concrete review material."));
  addFallbackMission(missions, fallbackMission("article_practice_completed", 1, "Article work strengthens structured academic responses."));
  addFallbackMission(missions, fallbackMission("daily_practice_days", 3, "Spacing practice across the week improves retention."));

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
      proposedTargetValue: mission.proposedTargetValue,
    });
    const currentValue = 0;
    const route = routeForMetric(metricType);
    const titleKey = TITLE_KEY_BY_METRIC[metricType] ?? "complete_podchat_sessions";
    const descriptionKey = DESCRIPTION_KEY_BY_METRIC[metricType] ?? "add_evaluated_speaking_samples";
    const finalTitleKey = mission.titleKey === titleKey ? mission.titleKey : titleKey;
    const finalDescriptionKey = mission.descriptionKey === descriptionKey ? mission.descriptionKey : descriptionKey;
    const routeTarget = mission.recommendedAction.routeTarget === route.recommendedAction.routeTarget
      ? mission.recommendedAction.routeTarget
      : route.recommendedAction.routeTarget;
    return {
      missionId: createWeeklyMissionId({
        ownerId: input.ownerId,
        weekStart: input.weekStart,
        metricType,
        index,
      }),
      title: renderWeeklyMissionTitle({
        titleKey: finalTitleKey,
        targetValue: target.targetValue,
      }),
      description: renderWeeklyMissionDescription({
        descriptionKey: finalDescriptionKey,
        targetValue: target.targetValue,
      }),
      reason: sanitizeMissionReason(mission.reason, metricType, mission.weaknessTarget),
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
      recommendedAction: {
        label: labelForRouteTarget(routeTarget),
        routeTarget,
      },
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
