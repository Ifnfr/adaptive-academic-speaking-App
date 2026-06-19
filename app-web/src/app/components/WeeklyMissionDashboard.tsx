"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WeeklyMission,
  WeeklyMissionDataSufficiency,
  WeeklyMissionPeriod,
  WeeklyMissionReview,
  WeeklyMissionRouteTarget,
  WeeklyMissionSourceFeature,
  WeeklyMissionStatus,
} from "../lib/weekly-review-missions";
import type { AppLanguage } from "../lib/i18n";

type WeeklyMissionDashboardProps = {
  appLanguage?: AppLanguage | null;
  onRouteTargetSelect: (routeTarget: WeeklyMissionRouteTarget) => void;
};

type WeeklyMissionUiState =
  | { status: "loading" }
  | { status: "not_generated"; period: WeeklyMissionPeriod }
  | { status: "generating"; period?: WeeklyMissionPeriod }
  | { status: "active"; review: WeeklyMissionReview; state: "created" | "existing" }
  | { status: "error"; message: string };

type WeeklyMissionGetResponse =
  | { state: "not_generated"; period: WeeklyMissionPeriod; review: null }
  | { state: "existing"; review: WeeklyMissionReview }
  | { error?: string };

type WeeklyMissionPostResponse =
  | { state: "created" | "existing"; review: WeeklyMissionReview }
  | { error?: string };

const SAFE_ERROR_MESSAGE =
  "Weekly missions are unavailable right now. Please try again.";
const SAFE_STORAGE_ERROR_MESSAGE =
  "Weekly mission storage is not ready yet. Please ask the site owner to finish setup, then try again.";
const STAGED_GENERATION_MESSAGES = [
  "Analyzing your learning data...",
  "Finding your weekly focus...",
  "Planning your weekly missions...",
  "Finalizing your mission board...",
] as const;

function isReviewResponse(
  value: WeeklyMissionGetResponse | WeeklyMissionPostResponse | null,
): value is { state: "created" | "existing"; review: WeeklyMissionReview } {
  return Boolean(
    value &&
      "review" in value &&
      value.review &&
      typeof value.review === "object" &&
      "state" in value &&
      (value.state === "created" || value.state === "existing"),
  );
}

function safeErrorMessageFor(value: WeeklyMissionGetResponse | WeeklyMissionPostResponse | null): string {
  return value && "error" in value && value.error === "weekly_mission_storage_unavailable"
    ? SAFE_STORAGE_ERROR_MESSAGE
    : SAFE_ERROR_MESSAGE;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function daysRemaining(weekEnd: string): number {
  const end = new Date(`${weekEnd}T23:59:59.999Z`);
  if (!Number.isFinite(end.getTime())) return 0;
  const diff = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
}

function dataSufficiencyLabel(value: WeeklyMissionDataSufficiency): string {
  switch (value) {
    case "starter":
      return "Starter plan";
    case "partial":
      return "Partial signal";
    case "strong":
      return "Strong signal";
  }
}

function statusLabel(status: WeeklyMissionStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "carried_over":
      return "Carried over";
    case "expired":
      return "Expired";
  }
}

function statusClass(status: WeeklyMissionStatus): string {
  switch (status) {
    case "completed":
      return "app-status-success";
    case "in_progress":
      return "app-status-info";
    case "carried_over":
    case "expired":
      return "app-status-warning";
    case "not_started":
      return "app-status-info";
  }
}

function sourceFeatureLabel(feature: WeeklyMissionSourceFeature): string {
  switch (feature) {
    case "podchat":
      return "Podchat";
    case "pattern_drill":
      return "Drill Mode";
    case "vocabulary":
      return "Vocabulary";
    case "article_practice":
      return "Article Practice";
    case "commonplace":
      return "Commonplace";
  }
}

function progressPercent(mission: WeeklyMission): number {
  if (mission.targetValue <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((mission.currentValue / mission.targetValue) * 100)),
  );
}

function WeeklyMissionProgress({ mission }: { mission: WeeklyMission }) {
  const boundedNow = Math.max(0, Math.min(mission.currentValue, mission.targetValue));
  const label = `${mission.title}: ${mission.currentValue} / ${mission.targetValue} ${mission.unit}`;

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={mission.targetValue}
        aria-valuenow={boundedNow}
        className="h-2.5 overflow-hidden rounded-full bg-[var(--brand-surface-2)]"
      >
        <div
          className="h-full rounded-full bg-[var(--brand-teal)] transition-[width]"
          style={{ width: `${progressPercent(mission)}%` }}
        />
      </div>
      <p className="font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
        {mission.currentValue} / {mission.targetValue} {mission.unit}
      </p>
    </div>
  );
}

function WeeklyMissionCard({
  mission,
  onRouteTargetSelect,
}: {
  mission: WeeklyMission;
  onRouteTargetSelect: (routeTarget: WeeklyMissionRouteTarget) => void;
}) {
  return (
    <article className="app-panel-muted flex min-w-0 flex-col gap-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-[var(--brand-ink)]">
            {mission.title}
          </h4>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
            {mission.reason}
          </p>
        </div>
        <span className={`app-status ${statusClass(mission.status)} self-start`}>
          {statusLabel(mission.status)}
        </span>
      </div>

      {mission.weaknessTarget && (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
            Focus
          </p>
          <p className="mt-1 text-sm text-[var(--brand-ink)]">
            {mission.weaknessTarget.label}
          </p>
        </div>
      )}

      <WeeklyMissionProgress mission={mission} />

      <div className="flex flex-wrap gap-2">
        {mission.sourceFeatures.map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-bg)] px-2 py-1 text-xs font-medium text-[var(--brand-ink-soft)]"
          >
            {sourceFeatureLabel(feature)}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="app-button app-button-secondary mt-auto w-full sm:w-fit"
        onClick={() => onRouteTargetSelect(mission.recommendedAction.routeTarget)}
      >
        {mission.recommendedAction.label}
      </button>
    </article>
  );
}

function WeeklyMissionEmptyState({
  period,
  loading,
  onGenerate,
}: {
  period: WeeklyMissionPeriod;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="app-panel-muted p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--brand-ink)]">
            Generate the weekly mission plan
          </h3>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">
            Generate the weekly mission plan based on your recent learning activity.
          </p>
          <p className="mt-2 text-xs text-[var(--brand-muted)]">
            Week: {formatWeekRange(period.weekStart, period.weekEnd)}
          </p>
        </div>
        <button
          type="button"
          className="app-button app-button-primary w-full sm:w-auto"
          onClick={onGenerate}
          disabled={loading}
        >
          {loading ? "Building your weekly mission plan..." : "Generate Weekly Missions"}
        </button>
      </div>
    </div>
  );
}

function WeeklyMissionErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-red-500/45 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-400/35 dark:bg-red-950/35 dark:text-red-100"
      data-testid="weekly-mission-error"
      role="alert"
    >
      <p>{message}</p>
      <button
        type="button"
        className="app-button app-button-danger mt-3 w-full sm:w-auto"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

function WeeklyMissionHeader({ review }: { review: WeeklyMissionReview }) {
  const remaining = daysRemaining(review.weekEnd);

  return (
    <header className="flex flex-col gap-4 border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            Weekly quest board
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
            Weekly Missions
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--brand-ink-soft)]">
            This week mission plan is already generated. Keep progressing until next week.
          </p>
        </div>
        <span className="app-status app-status-info self-start">
          {dataSufficiencyLabel(review.dataSufficiency)}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            Current week
          </dt>
          <dd className="mt-1 text-sm font-medium text-[var(--brand-ink)]">
            {formatWeekRange(review.weekStart, review.weekEnd)}
          </dd>
        </div>
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            Remaining
          </dt>
          <dd className="mt-1 text-sm font-medium text-[var(--brand-ink)]">
            {remaining === 1 ? "1 day left" : `${remaining} days left`}
          </dd>
        </div>
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            Next review
          </dt>
          <dd className="mt-1 text-sm font-medium text-[var(--brand-ink)]">
            {formatDateTime(review.nextReviewAvailableAt)}
          </dd>
        </div>
      </dl>
    </header>
  );
}

function WeeklyMissionActiveState({
  review,
  state,
  onRouteTargetSelect,
}: {
  review: WeeklyMissionReview;
  state: "created" | "existing";
  onRouteTargetSelect: (routeTarget: WeeklyMissionRouteTarget) => void;
}) {
  return (
    <>
      <WeeklyMissionHeader review={review} />
      <div className="flex flex-col gap-5 p-6">
        {state === "created" && (
          <div className="app-message app-message-success" role="status">
            Weekly missions generated. Your progress will update from saved app activity.
          </div>
        )}

        {review.dataSufficiency === "starter" && (
          <div className="app-message app-message-info">
            This is a starter mission plan. It builds a baseline before making deeper weakness diagnoses.
          </div>
        )}

        <section className="app-panel-muted p-5" aria-labelledby="weekly-mission-diagnosis">
          <h3
            id="weekly-mission-diagnosis"
            className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-teal)]"
          >
            Diagnosis summary
          </h3>
          <p className="mt-2 text-sm text-[var(--brand-ink)]">
            {review.diagnosisSummary}
          </p>
        </section>

        <section aria-labelledby="weekly-mission-list">
          <h3 id="weekly-mission-list" className="sr-only">
            Active weekly missions
          </h3>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {review.missions.map((mission) => (
              <WeeklyMissionCard
                key={mission.missionId}
                mission={mission}
                onRouteTargetSelect={onRouteTargetSelect}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export function WeeklyMissionDashboard({
  onRouteTargetSelect,
}: WeeklyMissionDashboardProps) {
  const [uiState, setUiState] = useState<WeeklyMissionUiState>({ status: "loading" });
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0);

  const fetchMissionReview = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/weekly-review/mission", {
        headers: { Accept: "application/json" },
        signal,
      });
      const data = (await response.json().catch(() => null)) as WeeklyMissionGetResponse | null;

      if (!response.ok || !data) {
        setUiState({ status: "error", message: safeErrorMessageFor(data) });
        return;
      }

      if ("state" in data && data.state === "not_generated" && data.period) {
        setUiState({ status: "not_generated", period: data.period });
        return;
      }

      if (isReviewResponse(data)) {
        setUiState({ status: "active", state: "existing", review: data.review });
        return;
      }

      setUiState({ status: "error", message: SAFE_ERROR_MESSAGE });
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      setUiState({ status: "error", message: SAFE_ERROR_MESSAGE });
    }
  }, []);

  const loadMissionReview = useCallback(() => {
    setUiState({ status: "loading" });
    void fetchMissionReview();
  }, [fetchMissionReview]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void fetchMissionReview(controller.signal);
      }
    });
    return () => controller.abort();
  }, [fetchMissionReview]);

  useEffect(() => {
    if (uiState.status !== "generating") {
      return;
    }
    const timer = window.setInterval(() => {
      setGenerationMessageIndex((current) =>
        (current + 1) % STAGED_GENERATION_MESSAGES.length,
      );
    }, 1200);
    return () => window.clearInterval(timer);
  }, [uiState.status]);

  const handleGenerate = useCallback(async () => {
    const period = uiState.status === "not_generated" ? uiState.period : undefined;
    setGenerationMessageIndex(0);
    setUiState({ status: "generating", period });
    try {
      const response = await fetch("/api/weekly-review/mission", {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => null)) as WeeklyMissionPostResponse | null;

      if (!response.ok || !data || !isReviewResponse(data)) {
        setUiState({ status: "error", message: safeErrorMessageFor(data) });
        return;
      }

      setUiState({
        status: "active",
        state: data.state,
        review: data.review,
      });
    } catch {
      setUiState({ status: "error", message: SAFE_ERROR_MESSAGE });
    }
  }, [uiState]);

  const loadingCopy = useMemo(() => {
    return uiState.status === "generating"
      ? STAGED_GENERATION_MESSAGES[generationMessageIndex]
      : "Loading weekly missions...";
  }, [generationMessageIndex, uiState.status]);

  return (
    <section className="app-panel brand-grid overflow-hidden" data-testid="weekly-mission-dashboard">
      {(uiState.status === "loading" || uiState.status === "generating") && (
        <div className="p-6" role="status" aria-live="polite">
          <div className="app-panel-muted p-5">
            <p className="text-sm font-medium text-[var(--brand-ink)]">
              {loadingCopy}
            </p>
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
              No progress numbers are shown until the server returns your mission plan.
            </p>
          </div>
        </div>
      )}

      {uiState.status === "not_generated" && (
        <div className="p-6">
          <WeeklyMissionEmptyState
            period={uiState.period}
            loading={false}
            onGenerate={handleGenerate}
          />
        </div>
      )}

      {uiState.status === "active" && (
        <WeeklyMissionActiveState
          review={uiState.review}
          state={uiState.state}
          onRouteTargetSelect={onRouteTargetSelect}
        />
      )}

      {uiState.status === "error" && (
        <div className="p-6">
          <WeeklyMissionErrorState
            message={uiState.message}
            onRetry={() => void loadMissionReview()}
          />
        </div>
      )}
    </section>
  );
}
