"use client";

import { useState } from "react";
import type {
  AppLanguage,
  FeedbackLanguage,
  TargetLanguage,
  Translate,
} from "../lib/i18n";
import {
  APP_LANGUAGES,
  DEFAULT_TARGET_LANGUAGE,
  FEEDBACK_LANGUAGES,
  normalizeAppLanguage,
  normalizeFeedbackLanguage,
  normalizeTargetLanguage,
  useI18n,
} from "../lib/i18n";
import type { UserProfile, UserProfilePreferencesPatch } from "../lib/storage/supabase-profile-adapter";

// ---------------------------------------------------------------------------
// UI tokens — mirrors the same constants used in page.tsx
// ---------------------------------------------------------------------------
const card =
  "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
const cardHeader =
  "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
const cardBody = "p-6";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export type ProfileSettingsViewProps = {
  // Auth state
  isSignedIn: boolean;
  appLanguage?: AppLanguage | null;
  // Profile loaded from Supabase (null = not loaded / unavailable)
  profile: UserProfile | null;
  profileLoadError: string | null;
  profileSaveStatus: "idle" | "saving" | "saved" | "error";
  profileSaveError: string | null;
  // Safe local stat counts only — never raw content
  totalXp: number;
  speakerLevel: number;
  speakerLevelName: string;
  dayStreak: number;
  totalSessions: number;
  vocabularyCount: number;
  earnedBadgeCount: number;
  articlePracticeCount: number;
  activeRecallCount: number;
  // Save callback
  onSavePreferences: (patch: UserProfilePreferencesPatch) => void;
  onAppLanguageChange?: (language: AppLanguage) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatJoinedDate(isoString: string | undefined): string {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
}

function getInitial(displayName: string, email: string | null): string {
  const name = displayName || email || "?";
  return name.trim().charAt(0).toUpperCase();
}

export function getProfileLanguagePreferenceState(
  profile: Pick<
    UserProfile,
    "preferredAppLanguage" | "feedbackLanguage" | "targetLanguage"
  > | null,
  appLanguage?: AppLanguage | null,
) {
  return {
    appLanguage: normalizeAppLanguage(
      profile?.preferredAppLanguage ?? appLanguage,
    ),
    feedbackLanguage: normalizeFeedbackLanguage(profile?.feedbackLanguage),
    targetLanguage: normalizeTargetLanguage(profile?.targetLanguage),
    appLanguageOptions: APP_LANGUAGES,
    feedbackLanguageOptions: FEEDBACK_LANGUAGES,
    targetLanguageOptions: [DEFAULT_TARGET_LANGUAGE] as const,
  };
}

export function buildProfileSettingsPreferencesPatch({
  displayName,
  bio,
  publicProfileEnabled,
  leaderboardOptIn,
  preferredAppLanguage,
  feedbackLanguage,
}: {
  displayName: string;
  bio: string;
  publicProfileEnabled: boolean;
  leaderboardOptIn: boolean;
  preferredAppLanguage: AppLanguage;
  feedbackLanguage: FeedbackLanguage;
}): UserProfilePreferencesPatch {
  return {
    displayName: displayName.trim() ? displayName.trim() : null,
    bio: bio.trim() ? bio.trim() : null,
    publicProfileEnabled,
    leaderboardOptIn,
    preferredAppLanguage: normalizeAppLanguage(preferredAppLanguage),
    feedbackLanguage: normalizeFeedbackLanguage(feedbackLanguage),
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)] last:border-b-0">
      <span className="text-sm text-[var(--brand-ink-soft)]">{label}</span>
      <span
        className="font-mono text-sm font-medium tabular-nums text-[var(--brand-ink)]"
        data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {value}
      </span>
    </div>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--brand-border)] last:border-b-0">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--brand-ink)] cursor-pointer"
        >
          {label}
        </label>
        <p className="mt-0.5 text-xs text-[var(--brand-ink-soft)]">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent",
          "transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "bg-[var(--brand-teal-ink)]"
            : "bg-[var(--brand-border)]",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0",
            "transition duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function LanguageSelect<T extends string>({
  id,
  label,
  value,
  options,
  optionLabels,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  optionLabels: Record<T, string>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--brand-ink-soft)]">
        {label}
      </span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Safe local stats card (shown for both signed-out and signed-in users)
// ---------------------------------------------------------------------------
function LocalStatsCard({
  t,
  totalXp,
  speakerLevel,
  speakerLevelName,
  dayStreak,
  totalSessions,
  vocabularyCount,
  earnedBadgeCount,
  articlePracticeCount,
  activeRecallCount,
}: {
  t: Translate;
  totalXp: number;
  speakerLevel: number;
  speakerLevelName: string;
  dayStreak: number;
  totalSessions: number;
  vocabularyCount: number;
  earnedBadgeCount: number;
  articlePracticeCount: number;
  activeRecallCount: number;
}) {
  return (
    <div className={card}>
      <div className={cardHeader}>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
          {t("profile.yourProgress")}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
          {t("profile.localStats")}
        </h2>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          Counts only — no transcripts, sentences, or private content shown.
        </p>
      </div>
      <div className={cardBody}>
        <div className="divide-y divide-[var(--brand-border)]">
          <StatRow label="Total XP" value={totalXp} />
          <StatRow
            label="Speaker Level"
            value={`Level ${speakerLevel} · ${speakerLevelName}`}
          />
          <StatRow label="Day Streak" value={`${dayStreak} day${dayStreak === 1 ? "" : "s"}`} />
          <StatRow label="Sessions Completed" value={totalSessions} />
          <StatRow label="Vocabulary Words" value={vocabularyCount} />
          <StatRow label="Badges Earned" value={earnedBadgeCount} />
          <StatRow label="Active Recall Sessions" value={activeRecallCount} />
          <StatRow label="Article Practice Sessions" value={articlePracticeCount} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed-out view
// ---------------------------------------------------------------------------
function SignedOutProfile({
  t,
  totalXp,
  speakerLevel,
  speakerLevelName,
  dayStreak,
  totalSessions,
  vocabularyCount,
  earnedBadgeCount,
  articlePracticeCount,
  activeRecallCount,
}: Omit<ProfileSettingsViewProps, "isSignedIn" | "appLanguage" | "profile" | "profileLoadError" | "profileSaveStatus" | "profileSaveError" | "onSavePreferences" | "onAppLanguageChange"> & { t: Translate }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Local profile info card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
            {t("profile.localProfile")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("profile.profileSettings")}
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            You are using fonetik in local mode.
          </p>
        </div>
        <div className={cardBody}>
          <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
            <p className="text-sm font-medium text-[var(--brand-ink)]">
              Learning data stays on this browser
            </p>
            <p className="mt-2 text-xs text-[var(--brand-ink-soft)] leading-relaxed">
              Your sessions, vocabulary, XP, and badges are stored only in this
              browser&apos;s local storage. No account is required to practice.
            </p>
            <p className="mt-4 text-xs text-[var(--brand-ink-soft)] leading-relaxed">
              To enable cloud backup and profile settings, configure Clerk and
              Supabase credentials in{" "}
              <code className="rounded bg-[var(--brand-surface-2)] px-1 py-0.5 font-mono text-xs border border-[var(--brand-border)]">
                app-web/.env.local
              </code>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Safe local stats */}
      <LocalStatsCard
        t={t}
        totalXp={totalXp}
        speakerLevel={speakerLevel}
        speakerLevelName={speakerLevelName}
        dayStreak={dayStreak}
        totalSessions={totalSessions}
        vocabularyCount={vocabularyCount}
        earnedBadgeCount={earnedBadgeCount}
        articlePracticeCount={articlePracticeCount}
        activeRecallCount={activeRecallCount}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed-in view
// ---------------------------------------------------------------------------
function SignedInProfile({
  t,
  appLanguage,
  profile,
  profileLoadError,
  profileSaveStatus,
  profileSaveError,
  totalXp,
  speakerLevel,
  speakerLevelName,
  dayStreak,
  totalSessions,
  vocabularyCount,
  earnedBadgeCount,
  articlePracticeCount,
  activeRecallCount,
  onSavePreferences,
  onAppLanguageChange,
}: Omit<ProfileSettingsViewProps, "isSignedIn"> & { t: Translate }) {
  // Local form state — seeded from profile when loaded
  const [displayName, setDisplayName] = useState<string>(
    profile?.displayName ?? ""
  );
  const [bio, setBio] = useState<string>(profile?.bio ?? "");
  const [publicProfileEnabled, setPublicProfileEnabled] = useState<boolean>(
    profile?.publicProfileEnabled ?? false
  );
  const [leaderboardOptIn, setLeaderboardOptIn] = useState<boolean>(
    profile?.leaderboardOptIn ?? false
  );
  const initialLanguagePreferences = getProfileLanguagePreferenceState(
    profile,
    appLanguage,
  );
  const [selectedAppLanguage, setSelectedAppLanguage] = useState<AppLanguage>(
    initialLanguagePreferences.appLanguage
  );
  const [selectedFeedbackLanguage, setSelectedFeedbackLanguage] =
    useState<FeedbackLanguage>(initialLanguagePreferences.feedbackLanguage);
  const [selectedTargetLanguage] = useState<TargetLanguage>(
    initialLanguagePreferences.targetLanguage
  );

  // Re-seed local form state when profile loads (first time, not on re-renders)
  // We use a key pattern: the parent resets this component when profile changes.
  // (Done via the key prop on this component in the parent section below.)

  const isSaving = profileSaveStatus === "saving";

  function handleSave() {
    onSavePreferences(
      buildProfileSettingsPreferencesPatch({
        displayName,
        bio,
        publicProfileEnabled,
        leaderboardOptIn,
        preferredAppLanguage: selectedAppLanguage,
        feedbackLanguage: selectedFeedbackLanguage,
      }),
    );
  }

  function handleAppLanguageChange(nextLanguage: AppLanguage) {
    setSelectedAppLanguage(nextLanguage);
    onAppLanguageChange?.(nextLanguage);
  }

  const joinedDate = profile?.createdAt
    ? formatJoinedDate(profile.createdAt)
    : null;
  const initial = getInitial(
    profile?.displayName ?? "",
    profile?.email ?? null
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Account card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
            {t("profile.account")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("profile.profileSettings")}
          </h2>
        </div>
        <div className={cardBody}>
          {profileLoadError && (
            <div
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              data-testid="profile-load-error"
            >
              {profileLoadError}
            </div>
          )}
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt="Profile avatar"
                className="h-14 w-14 rounded-full object-cover border border-[var(--brand-border)]"
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-teal-ink)] text-white text-xl font-semibold"
                aria-label="Avatar initials"
              >
                {initial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p
                className="text-base font-semibold text-[var(--brand-ink)] truncate"
                data-testid="profile-display-name"
              >
                {profile?.displayName || "—"}
              </p>
              {profile?.email && (
                <p className="mt-0.5 text-xs text-[var(--brand-ink-soft)] truncate">
                  <span className="text-[var(--brand-muted)]">Private · </span>
                  <span data-testid="profile-email">{profile.email}</span>
                </p>
              )}
              {joinedDate && (
                <p className="mt-0.5 text-xs text-[var(--brand-muted)]">
                  Joined {joinedDate}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile & Privacy form card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
            {t("profile.profileSettingsSection")}
          </p>
          <h3 className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
            {t("profile.profilePrivacy")}
          </h3>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            Enabling sharing settings will never publish transcripts, retry
            transcripts, vocabulary sentences, AI corrections, article URLs,
            weaknesses, retry tasks, session CSV content, or private notes.
          </p>
        </div>
        <div className={cardBody}>
          <div className="flex flex-col gap-5">
            {/* Display name */}
            <div>
              <label
                htmlFor="profile-display-name-input"
                className="block text-sm font-medium text-[var(--brand-ink)] mb-1.5"
              >
                {t("profile.displayName")}
              </label>
              <input
                id="profile-display-name-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                disabled={isSaving}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:opacity-50"
                placeholder="Your display name"
              />
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="profile-bio-input"
                className="block text-sm font-medium text-[var(--brand-ink)] mb-1.5"
              >
                {t("profile.bio")}
                <span className="ml-1 text-xs font-normal text-[var(--brand-muted)]">
                  ({bio.length}/200)
                </span>
              </label>
              <textarea
                id="profile-bio-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={3}
                disabled={isSaving}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] resize-none disabled:opacity-50"
                placeholder="A short note about your learning goals (optional)"
              />
            </div>

            {/* Privacy toggles */}
            <div>
              <p className="text-sm font-medium text-[var(--brand-ink)] mb-2">
                Sharing &amp; privacy
              </p>
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 divide-y divide-[var(--brand-border)]">
                <Toggle
                  id="toggle-public-profile"
                  label={t("profile.publicProfile")}
                  description="No public profile page exists yet — this setting will be used when public profiles launch in a future update."
                  checked={publicProfileEnabled}
                  onChange={setPublicProfileEnabled}
                  disabled={isSaving}
                />
                <Toggle
                  id="toggle-leaderboard-opt-in"
                  label={t("profile.leaderboardOptIn")}
                  description="No leaderboard exists yet — this setting will be used when a leaderboard launches in a future update."
                  checked={leaderboardOptIn}
                  onChange={setLeaderboardOptIn}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Language preferences */}
            <div>
              <p className="text-sm font-medium text-[var(--brand-ink)] mb-2">
                {t("profile.languagePreferences")}
              </p>
              <div className="grid gap-3 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 sm:grid-cols-3">
                <LanguageSelect
                  id="profile-app-language-select"
                  label={t("profile.appLanguage")}
                  value={selectedAppLanguage}
                  options={APP_LANGUAGES}
                  optionLabels={{
                    en: t("profile.english"),
                    id: t("profile.indonesian"),
                  }}
                  onChange={handleAppLanguageChange}
                  disabled={isSaving}
                />
                <LanguageSelect
                  id="profile-feedback-language-select"
                  label={t("profile.feedbackLanguage")}
                  value={selectedFeedbackLanguage}
                  options={FEEDBACK_LANGUAGES}
                  optionLabels={{
                    en: t("profile.english"),
                    id: t("profile.indonesian"),
                  }}
                  onChange={setSelectedFeedbackLanguage}
                  disabled={isSaving}
                />
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--brand-ink-soft)]">
                    {t("profile.targetLanguage")}
                  </span>
                  <select
                    id="profile-target-language-select"
                    value={selectedTargetLanguage}
                    disabled
                    className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value={DEFAULT_TARGET_LANGUAGE}>
                      {t("profile.english")}
                    </option>
                  </select>
                  <span className="text-[11px] text-[var(--brand-muted)]">
                    {t("profile.targetLanguageFixed")}
                  </span>
                </label>
              </div>
            </div>

            {/* Save button + status */}
            <div className="flex flex-col gap-2">
              <button
                id="profile-save-btn"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-[var(--brand-teal-ink)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-1"
              >
                {isSaving ? t("profile.saving") : t("profile.saveProfileSettings")}
              </button>

              {profileSaveStatus === "saved" && (
                <p
                  className="text-xs text-green-600"
                  data-testid="profile-save-success"
                >
                  {t("profile.saved")}
                </p>
              )}
              {profileSaveStatus === "error" && profileSaveError && (
                <p
                  className="text-xs text-red-600"
                  data-testid="profile-save-error"
                >
                  {profileSaveError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safe local stats */}
      <LocalStatsCard
        t={t}
        totalXp={totalXp}
        speakerLevel={speakerLevel}
        speakerLevelName={speakerLevelName}
        dayStreak={dayStreak}
        totalSessions={totalSessions}
        vocabularyCount={vocabularyCount}
        earnedBadgeCount={earnedBadgeCount}
        articlePracticeCount={articlePracticeCount}
        activeRecallCount={activeRecallCount}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function ProfileSettingsView({
  isSignedIn,
  appLanguage,
  profile,
  profileLoadError,
  profileSaveStatus,
  profileSaveError,
  totalXp,
  speakerLevel,
  speakerLevelName,
  dayStreak,
  totalSessions,
  vocabularyCount,
  earnedBadgeCount,
  articlePracticeCount,
  activeRecallCount,
  onSavePreferences,
  onAppLanguageChange,
}: ProfileSettingsViewProps) {
  const { t } = useI18n(appLanguage);

  if (!isSignedIn) {
    return (
      <SignedOutProfile
        t={t}
        totalXp={totalXp}
        speakerLevel={speakerLevel}
        speakerLevelName={speakerLevelName}
        dayStreak={dayStreak}
        totalSessions={totalSessions}
        vocabularyCount={vocabularyCount}
        earnedBadgeCount={earnedBadgeCount}
        articlePracticeCount={articlePracticeCount}
        activeRecallCount={activeRecallCount}
      />
    );
  }

  return (
    // key resets local form state whenever a new profile loads
    <SignedInProfile
      key={profile?.ownerId ?? "loading"}
      profile={profile}
      profileLoadError={profileLoadError}
      profileSaveStatus={profileSaveStatus}
      profileSaveError={profileSaveError}
      totalXp={totalXp}
      speakerLevel={speakerLevel}
      speakerLevelName={speakerLevelName}
      dayStreak={dayStreak}
      totalSessions={totalSessions}
      vocabularyCount={vocabularyCount}
      earnedBadgeCount={earnedBadgeCount}
      articlePracticeCount={articlePracticeCount}
      activeRecallCount={activeRecallCount}
      onSavePreferences={onSavePreferences}
      onAppLanguageChange={onAppLanguageChange}
      t={t}
      appLanguage={appLanguage}
    />
  );
}
