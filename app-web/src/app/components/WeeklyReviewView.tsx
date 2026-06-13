import type { AppLanguage } from "../lib/i18n";
import { useI18n } from "../lib/i18n";

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
};

function SummaryCell({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </dt>
      <dd
        className={
          multiline
            ? "whitespace-pre-wrap break-words text-sm text-[var(--brand-ink)]"
            : "text-sm text-[var(--brand-ink)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function WeeklyReviewView({
  provider,
  weeklyReviewResult,
  weeklyReviewLoading,
  weeklyReviewError,
  appLanguage,
  onRunWeeklyReview,
}: WeeklyReviewViewProps) {
  const { t } = useI18n(appLanguage);
  const card = "app-panel brand-grid";
  const cardHeader =
    "border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
  const cardBody = "p-6";
  const labelClass =
    "app-label mb-2 block";
  const buttonPrimary = "app-button app-button-primary";
  const buttonDanger = "app-button app-button-danger";

  return (
    <section className={card}>
      <div className={`${cardHeader} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            {t("common.aiReview")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("topbar.titleWeeklyReview")}
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            {t("common.weeklyTagline")}
          </p>
        </div>
        <span className="app-status">
          Server memory
        </span>
      </div>
      <div className={`${cardBody} flex flex-col gap-5`}>
        <div className="app-panel-muted p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={labelClass}>{t("common.readyToReview")}</p>
              <p className="text-sm text-[var(--brand-ink)]">
                {t("review.usesLatest")} ({provider})
              </p>
              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                {t("review.transcriptsNotSent")}
              </p>
            </div>
            <button
              type="button"
              onClick={onRunWeeklyReview}
              disabled={weeklyReviewLoading}
              className={`${buttonPrimary} w-full sm:w-auto`}
            >
              {weeklyReviewLoading
                ? t("review.running")
                : t("review.runBtn")}
            </button>
          </div>
        </div>

        {weeklyReviewError && (
          <div
            role="alert"
            className="app-message app-message-error"
          >
            <p>{weeklyReviewError}</p>
            <p className="mt-1 text-xs opacity-80">
              {t("review.errorTagline")}
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onRunWeeklyReview}
                disabled={weeklyReviewLoading}
                className={`${buttonDanger} min-h-9 px-3 py-1.5 text-xs`}
              >
                {weeklyReviewLoading ? t("review.tryingAgain") : t("review.tryAgain")}
              </button>
            </div>
          </div>
        )}

        {weeklyReviewResult && (
          <div className="app-panel-muted border-l-4 border-l-[var(--brand-teal)] p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              {t("review.resultTitle")}
            </h3>

            {weeklyReviewResult.warnings.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="app-message app-message-info border-dashed p-6 text-center">
                  {weeklyReviewResult.warnings.map((warning, idx) => (
                    <p key={idx} className="text-sm font-medium text-[var(--brand-ink)]">
                      {warning}
                    </p>
                  ))}
                  <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                    {weeklyReviewResult.summary}
                  </p>
                </div>

                <div className="border-t border-[var(--brand-border)] pt-4">
                  <p className={labelClass}>{t("review.plan")}</p>
                  <ol className="list-none space-y-1 text-sm text-[var(--brand-ink)]">
                    {weeklyReviewResult.recommendedPlan.map((item, i) => (
                      <li key={i} className="break-words">
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <SummaryCell
                    label={t("review.summary")}
                    value={weeklyReviewResult.summary}
                    multiline
                  />
                  <SummaryCell
                    label={t("review.recurringWeakness")}
                    value={weeklyReviewResult.recurringWeakness}
                    multiline
                  />
                  <SummaryCell
                    label={t("review.bestImprovement")}
                    value={weeklyReviewResult.bestImprovement}
                    multiline
                  />
                  <SummaryCell
                    label={t("review.scoreTrend")}
                    value={weeklyReviewResult.scoreTrend}
                    multiline
                  />
                  <div className="sm:col-span-2">
                    <SummaryCell
                      label={t("review.nextWeekFocus")}
                      value={weeklyReviewResult.nextWeekFocus}
                      multiline
                    />
                  </div>
                </dl>

                <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                  <p className={labelClass}>{t("review.plan")}</p>
                  <ol className="list-none space-y-1 text-sm text-[var(--brand-ink)]">
                    {weeklyReviewResult.recommendedPlan.map((item, i) => (
                      <li key={i} className="break-words">
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
