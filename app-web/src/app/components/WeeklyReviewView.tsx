import type { AppLanguage } from "../lib/i18n";
import type { WeeklyMissionRouteTarget } from "../lib/weekly-review-missions";
import { WeeklyMissionDashboard } from "./WeeklyMissionDashboard";

export type WeeklyReviewResult = {
  summary: string;
  recurringWeakness: string;
  bestImprovement: string;
  scoreTrend: string;
  nextWeekFocus: string;
  recommendedPlan: string[];
  warnings: string[];
};

type WeeklyReviewViewProps = {
  provider: string;
  weeklyReviewResult: WeeklyReviewResult | null;
  weeklyReviewLoading: boolean;
  weeklyReviewError: string | null;
  appLanguage?: AppLanguage | null;
  onRunWeeklyReview: () => void;
  onMissionRouteSelect: (routeTarget: WeeklyMissionRouteTarget) => void;
};

export function WeeklyReviewView(props: WeeklyReviewViewProps) {
  return (
    <WeeklyMissionDashboard
      appLanguage={props.appLanguage}
      onRouteTargetSelect={props.onMissionRouteSelect}
    />
  );
}
