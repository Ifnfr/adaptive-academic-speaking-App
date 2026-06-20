import { deriveWeeklyMissionStatus } from "../weekly-review-missions";
import type {
  WeeklyMission,
  WeeklyMissionDataSufficiency,
  WeeklyMissionMetricType,
  WeeklyMissionReview,
  WeeklyMissionReviewStatus,
} from "../weekly-review-missions";
import type { FonetikSupabaseClient } from "../supabase";

const TABLE = "weekly_mission_reviews";

export const READY_WEEKLY_MISSION_METRICS: WeeklyMissionMetricType[] = [
  "speaking_minutes",
  "podchat_sessions",
  "pattern_drill_sessions",
  "vocabulary_collected",
  "vocab_sentence_submitted",
  "vocab_correction_saved",
  "article_practice_completed",
  "daily_practice_days",
  "listening_exercise_sessions",
];

export type WeeklyMissionSourceSnapshot = {
  podchatSessions: number;
  speakingSeconds: number;
  speakingMinutes: number;
  patternDrillSessions: number;
  vocabularyCollected: number;
  vocabularySentencesSubmitted: number;
  vocabularyCorrectionsSaved: number;
  articlePracticeCompleted: number;
  listeningExerciseSessions: number;
  activeDays: string[];
  repeatedWeaknessCount: number;
  topWeaknesses: Array<{
    category: string;
    label: string;
    count: number;
    practiceFocus?: string;
  }>;
};

export type WeeklyMissionReviewRow = {
  id: string;
  owner_id: string;
  week_start: string;
  week_end: string;
  timezone: string;
  generated_at: string;
  diagnosis_summary: string;
  data_sufficiency: string;
  missions: unknown;
  mission_count: number;
  status: string;
  source_snapshot: unknown;
  next_review_available_at: string;
  provider: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveWeeklyMissionReviewInput = {
  ownerId: string;
  weekStart: string;
  weekEnd: string;
  timezone: string;
  generatedAt: string;
  diagnosisSummary: string;
  dataSufficiency: WeeklyMissionDataSufficiency;
  missions: WeeklyMission[];
  status: WeeklyMissionReviewStatus;
  sourceSnapshot: WeeklyMissionSourceSnapshot;
  nextReviewAvailableAt: string;
  provider?: string | null;
};

type TimestampRow = {
  id?: string;
  created_at?: string | null;
  checked_at?: string | null;
  completed_at?: string | null;
};

type PodchatSnapshotRow = TimestampRow & {
  duration_seconds?: number | null;
  elapsed_seconds?: number | null;
};

type WeaknessRow = TimestampRow & {
  category?: string | null;
  label?: string | null;
  practice_focus?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function dateRange(weekStart: string, weekEnd: string) {
  return {
    start: `${weekStart}T00:00:00.000Z`,
    end: `${weekEnd}T23:59:59.999Z`,
  };
}

function utcDateFromTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function deriveWeeklyMissionActiveDays(
  rows: ReadonlyArray<{ created_at?: string | null; checked_at?: string | null; completed_at?: string | null }>,
): string[] {
  const days = new Set<string>();
  for (const row of rows) {
    const day = utcDateFromTimestamp(row.created_at ?? row.checked_at ?? row.completed_at);
    if (day) days.add(day);
  }
  return Array.from(days).sort();
}

function normalizeTopWeaknesses(rows: ReadonlyArray<WeaknessRow>) {
  const grouped = new Map<string, { category: string; label: string; count: number; practiceFocus?: string }>();

  for (const row of rows) {
    const category = typeof row.category === "string" && row.category.trim()
      ? row.category.trim()
      : "General";
    const label = typeof row.label === "string" && row.label.trim()
      ? row.label.trim()
      : "Practice focus";
    const key = `${category}:${label}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.practiceFocus && row.practice_focus) {
        existing.practiceFocus = row.practice_focus;
      }
    } else {
      grouped.set(key, {
        category,
        label,
        count: 1,
        practiceFocus: row.practice_focus ?? undefined,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
}

function readWarnings(source: unknown): string[] {
  if (!isRecord(source) || !Array.isArray(source.warnings)) return [];
  return source.warnings.filter((item): item is string => typeof item === "string");
}

function coerceMissions(value: unknown): WeeklyMission[] {
  return Array.isArray(value) ? (value as WeeklyMission[]) : [];
}

export function mapWeeklyMissionReviewRow(row: WeeklyMissionReviewRow): WeeklyMissionReview {
  return {
    reviewId: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    timezone: row.timezone,
    generatedAt: row.generated_at,
    diagnosisSummary: row.diagnosis_summary,
    dataSufficiency: row.data_sufficiency as WeeklyMissionDataSufficiency,
    missions: coerceMissions(row.missions),
    missionCount: row.mission_count,
    status: row.status as WeeklyMissionReviewStatus,
    nextReviewAvailableAt: row.next_review_available_at,
    warnings: readWarnings(row.source_snapshot),
  };
}

export async function getCachedWeeklyMissionReview(
  ownerId: string,
  weekStart: string,
  weekEnd: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<WeeklyMissionReview | null> {
  if (!ownerId || !weekStart || !weekEnd) return null;

  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("id, owner_id, week_start, week_end, timezone, generated_at, diagnosis_summary, data_sufficiency, missions, mission_count, status, source_snapshot, next_review_available_at, provider, created_at, updated_at")
    .eq("owner_id", ownerId)
    .eq("week_start", weekStart)
    .eq("week_end", weekEnd)
    .maybeSingle();

  if (error || !data) return null;
  return mapWeeklyMissionReviewRow(data as WeeklyMissionReviewRow);
}

export async function saveWeeklyMissionReview(
  input: SaveWeeklyMissionReviewInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<{ ok: true; review: WeeklyMissionReview; existing: boolean } | { ok: false; error: string }> {
  if (!input.ownerId || !input.weekStart || !input.weekEnd || input.missions.length < 1 || input.missions.length > 5) {
    return { ok: false, error: "invalid_weekly_mission_review" };
  }

  const existing = await getCachedWeeklyMissionReview(
    input.ownerId,
    input.weekStart,
    input.weekEnd,
    supabaseClient,
  );
  if (existing) {
    return { ok: true, review: existing, existing: true };
  }

  const { data, error } = await supabaseClient
    .from(TABLE)
    .insert({
      owner_id: input.ownerId,
      week_start: input.weekStart,
      week_end: input.weekEnd,
      timezone: input.timezone || "UTC",
      generated_at: input.generatedAt,
      diagnosis_summary: input.diagnosisSummary,
      data_sufficiency: input.dataSufficiency,
      missions: input.missions,
      mission_count: input.missions.length,
      status: input.status,
      source_snapshot: input.sourceSnapshot,
      next_review_available_at: input.nextReviewAvailableAt,
      provider: input.provider ?? null,
    })
    .select("id, owner_id, week_start, week_end, timezone, generated_at, diagnosis_summary, data_sufficiency, missions, mission_count, status, source_snapshot, next_review_available_at, provider, created_at, updated_at")
    .single();

  if (!error && data) {
    return {
      ok: true,
      review: mapWeeklyMissionReviewRow(data as WeeklyMissionReviewRow),
      existing: false,
    };
  }

  const conflictReview = await getCachedWeeklyMissionReview(
    input.ownerId,
    input.weekStart,
    input.weekEnd,
    supabaseClient,
  );
  if (conflictReview) {
    return { ok: true, review: conflictReview, existing: true };
  }

  return { ok: false, error: "weekly_mission_review_save_failed" };
}

async function selectRows<T>(
  supabaseClient: FonetikSupabaseClient,
  table: string,
  columns: string,
  ownerId: string,
  timestampColumn: "created_at" | "checked_at",
  weekStart: string,
  weekEnd: string,
): Promise<T[]> {
  const range = dateRange(weekStart, weekEnd);
  const { data, error } = await supabaseClient
    .from(table)
    .select(columns)
    .eq("owner_id", ownerId)
    .gte(timestampColumn, range.start)
    .lte(timestampColumn, range.end);

  if (error) throw error;
  return ((data as T[] | null) ?? []);
}

export async function getWeeklyMissionSourceSnapshot(input: {
  ownerId: string;
  weekStart: string;
  weekEnd: string;
}, supabaseClient: FonetikSupabaseClient): Promise<WeeklyMissionSourceSnapshot> {
  const range = dateRange(input.weekStart, input.weekEnd);
  const [
    podchatRows,
    patternRows,
    vocabularyRows,
    sentenceRows,
    correctionRows,
    articleRows,
    weaknessRows,
    listeningResult,
  ] = await Promise.all([
    selectRows<PodchatSnapshotRow>(supabaseClient, "podchat_sessions", "id, created_at, duration_seconds, elapsed_seconds", input.ownerId, "created_at", input.weekStart, input.weekEnd),
    selectRows<TimestampRow>(supabaseClient, "pattern_drill_sessions", "id, created_at", input.ownerId, "created_at", input.weekStart, input.weekEnd),
    selectRows<TimestampRow>(supabaseClient, "vocabulary_items", "id, created_at", input.ownerId, "created_at", input.weekStart, input.weekEnd),
    selectRows<TimestampRow>(supabaseClient, "vocabulary_sentences", "id, created_at", input.ownerId, "created_at", input.weekStart, input.weekEnd),
    selectRows<TimestampRow>(supabaseClient, "vocabulary_corrections", "id, checked_at", input.ownerId, "checked_at", input.weekStart, input.weekEnd),
    selectRows<TimestampRow>(supabaseClient, "article_writing_sessions", "id, created_at", input.ownerId, "created_at", input.weekStart, input.weekEnd),
    selectRows<WeaknessRow>(supabaseClient, "learner_error_patterns", "id, created_at, category, label, practice_focus", input.ownerId, "created_at", input.weekStart, input.weekEnd),
    supabaseClient
      .from("listening_exercise_sessions")
      .select("id, completed_at")
      .eq("owner_id", input.ownerId)
      .eq("status", "completed")
      .gte("completed_at", range.start)
      .lte("completed_at", range.end),
  ]);

  if (listeningResult.error) throw listeningResult.error;
  const listeningRows = (listeningResult.data as TimestampRow[] | null) ?? [];

  const speakingSeconds = podchatRows.reduce((sum, row) => {
    const elapsed = safeCount(row.elapsed_seconds);
    return sum + (elapsed > 0 ? elapsed : safeCount(row.duration_seconds));
  }, 0);

  const activityRows = [
    ...podchatRows,
    ...patternRows,
    ...vocabularyRows,
    ...sentenceRows,
    ...correctionRows,
    ...articleRows,
    ...listeningRows,
  ];

  return {
    podchatSessions: podchatRows.length,
    speakingSeconds,
    speakingMinutes: Math.floor(speakingSeconds / 60),
    patternDrillSessions: patternRows.length,
    vocabularyCollected: vocabularyRows.length,
    vocabularySentencesSubmitted: sentenceRows.length,
    vocabularyCorrectionsSaved: correctionRows.length,
    articlePracticeCompleted: articleRows.length,
    listeningExerciseSessions: listeningRows.length,
    activeDays: deriveWeeklyMissionActiveDays(activityRows),
    repeatedWeaknessCount: normalizeTopWeaknesses(weaknessRows).filter((item) => item.count > 1).length,
    topWeaknesses: normalizeTopWeaknesses(weaknessRows),
  };
}

function progressForMetric(metricType: WeeklyMissionMetricType, snapshot: WeeklyMissionSourceSnapshot): number {
  switch (metricType) {
    case "speaking_minutes":
      return snapshot.speakingMinutes;
    case "podchat_sessions":
      return snapshot.podchatSessions;
    case "pattern_drill_sessions":
      return snapshot.patternDrillSessions;
    case "vocabulary_collected":
      return snapshot.vocabularyCollected;
    case "vocab_sentence_submitted":
      return snapshot.vocabularySentencesSubmitted;
    case "vocab_correction_saved":
      return snapshot.vocabularyCorrectionsSaved;
    case "article_practice_completed":
      return snapshot.articlePracticeCompleted;
    case "listening_exercise_sessions":
      return snapshot.listeningExerciseSessions;
    case "daily_practice_days":
      return snapshot.activeDays.length;
    case "vocabulary_reviewed":
    case "weakness_resolution":
      return 0;
  }
}

export function calculateWeeklyMissionProgress(input: {
  missions: WeeklyMission[];
  sourceSnapshot: WeeklyMissionSourceSnapshot;
  now: Date;
}): WeeklyMission[] {
  return input.missions.map((mission) => {
    const currentValue = progressForMetric(mission.metricType, input.sourceSnapshot);
    return {
      ...mission,
      currentValue,
      status: deriveWeeklyMissionStatus({
        currentValue,
        targetValue: mission.targetValue,
        now: input.now,
        weekEnd: mission.weekEnd,
        carriedOver: mission.status === "carried_over",
      }),
    };
  });
}

export function selectEnabledMissionMetrics(): WeeklyMissionMetricType[] {
  return [...READY_WEEKLY_MISSION_METRICS];
}
