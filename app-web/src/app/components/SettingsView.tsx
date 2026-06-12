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
import {
  COMMONPLACE_THEME_CHOICES,
  normalizeCommonplaceThemeColorId,
  type CommonplaceThemeColorId,
} from "../lib/commonplace-theme";
import type { UserProfile, UserProfilePreferencesPatch } from "../lib/storage/supabase-profile-adapter";

// UI tokens matching style
const card =
  "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid overflow-hidden";
const cardHeader =
  "border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
const cardBody = "p-6";

export type SettingsViewProps = {
  isSignedIn: boolean;
  appLanguage?: AppLanguage | null;
  profile: UserProfile | null;
  profileLoadError: string | null;
  profileSaveStatus: "idle" | "saving" | "saved" | "error";
  profileSaveError: string | null;
  onSavePreferences: (patch: UserProfilePreferencesPatch) => void;
  onAppLanguageChange?: (language: AppLanguage) => void;
  defaultAiProvider?: string;
  onDefaultAiProviderChange?: (provider: "Claude" | "Gemini" | "DeepSeek") => void;
  defaultTtsProvider?: "polly" | "elevenlabs";
  onDefaultTtsProviderChange?: (provider: "polly" | "elevenlabs") => void;
  defaultElevenLabsModel?: "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "";
  onDefaultElevenLabsModelChange?: (model: "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "") => void;
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
  commonplaceCanvasColor,
  commonplaceCardColor,
}: {
  displayName: string;
  bio: string;
  publicProfileEnabled: boolean;
  leaderboardOptIn: boolean;
  preferredAppLanguage: AppLanguage;
  feedbackLanguage: FeedbackLanguage;
  commonplaceCanvasColor?: CommonplaceThemeColorId;
  commonplaceCardColor?: CommonplaceThemeColorId;
}): UserProfilePreferencesPatch {
  return {
    displayName: displayName.trim() ? displayName.trim() : null,
    bio: bio.trim() ? bio.trim() : null,
    publicProfileEnabled,
    leaderboardOptIn,
    preferredAppLanguage: normalizeAppLanguage(preferredAppLanguage),
    feedbackLanguage: normalizeFeedbackLanguage(feedbackLanguage),
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    commonplaceCanvasColor: normalizeCommonplaceThemeColorId(
      commonplaceCanvasColor,
    ),
    commonplaceCardColor: normalizeCommonplaceThemeColorId(commonplaceCardColor),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------


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
    <label className="flex flex-col gap-1.5 font-sans">
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

function CommonplaceThemeSwatches({
  legend,
  value,
  onChange,
  disabled,
  testId,
}: {
  legend: string;
  value: CommonplaceThemeColorId;
  onChange: (value: CommonplaceThemeColorId) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <fieldset className="min-w-0" data-testid={testId}>
      <legend className="text-xs font-medium text-[var(--brand-ink-soft)]">
        {legend}
      </legend>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {COMMONPLACE_THEME_CHOICES.map((choice) => {
          const isSelected = value === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onChange(choice.id)}
              className={[
                "flex min-h-[4.5rem] flex-col items-start justify-between rounded-lg border px-2.5 py-2 text-left transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)]"
                  : "border-[var(--brand-border)] bg-white text-[var(--brand-ink)] hover:border-[var(--brand-teal)]/40",
              ].join(" ")}
              data-testid={`${testId}-option-${choice.id}`}
            >
              <span
                className="h-6 w-6 rounded-full border border-black/10 shadow-inner"
                style={{ backgroundColor: choice.swatch }}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold leading-4">
                {choice.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Signed-out Settings
// ---------------------------------------------------------------------------
function SignedOutSettings({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-6" data-testid="settings-signed-out">
      {/* Local profile info notice */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
            {t("profile.localProfile")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("profile.profileSettings")}
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)] font-sans">
            You are using fonetik in local mode.
          </p>
        </div>
        <div className={cardBody}>
          <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 font-sans">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed-in Settings
// ---------------------------------------------------------------------------
function SignedInSettings({
  t,
  appLanguage,
  profile,
  profileLoadError,
  profileSaveStatus,
  profileSaveError,
  onSavePreferences,
  onAppLanguageChange,
}: Omit<SettingsViewProps, "isSignedIn"> & { t: Translate }) {
  // Local form state
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
  const [selectedCommonplaceCanvasColor, setSelectedCommonplaceCanvasColor] =
    useState<CommonplaceThemeColorId>(
      normalizeCommonplaceThemeColorId(profile?.commonplaceCanvasColor),
    );
  const [selectedCommonplaceCardColor, setSelectedCommonplaceCardColor] =
    useState<CommonplaceThemeColorId>(
      normalizeCommonplaceThemeColorId(profile?.commonplaceCardColor),
    );

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
        commonplaceCanvasColor: selectedCommonplaceCanvasColor,
        commonplaceCardColor: selectedCommonplaceCardColor,
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
    <div className="flex flex-col gap-6" data-testid="settings-signed-in">
      {/* Account info card */}
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
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-sans"
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
                <p className="mt-0.5 text-xs text-[var(--brand-ink-soft)] truncate font-sans">
                  <span className="text-[var(--brand-muted)] font-semibold">Private · </span>
                  <span data-testid="profile-email">{profile.email}</span>
                </p>
              )}
              {joinedDate && (
                <p className="mt-0.5 text-xs text-[var(--brand-muted)] font-sans">
                  Joined {joinedDate}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editable preferences card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
            {t("profile.profileSettingsSection")}
          </p>
          <h3 className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
            {t("profile.profilePrivacy")}
          </h3>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)] font-sans leading-relaxed">
            Enabling sharing settings will never publish transcripts, retry
            transcripts, vocabulary sentences, AI corrections, article URLs,
            weaknesses, retry tasks, session CSV content, or private notes.
          </p>
        </div>
        <div className={cardBody}>
          <div className="flex flex-col gap-5">
            {/* Display name field */}
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

            {/* Bio field */}
            <div>
              <label
                htmlFor="profile-bio-input"
                className="block text-sm font-medium text-[var(--brand-ink)] mb-1.5"
              >
                {t("profile.bio")}
                <span className="ml-1 text-xs font-normal text-[var(--brand-muted)] font-mono">
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

            {/* Privacy switches */}
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
                  description="Celebrate progress and consistency by joining the public leaderboard rankings."
                  checked={leaderboardOptIn}
                  onChange={setLeaderboardOptIn}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Language selectors */}
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
                <label className="flex flex-col gap-1.5 font-sans">
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
                  <span className="text-[11px] text-[var(--brand-muted)] font-sans">
                    {t("profile.targetLanguageFixed")}
                  </span>
                </label>
              </div>
            </div>

            {/* Actions & Status */}
            <div>
              <p className="text-sm font-medium text-[var(--brand-ink)] mb-2">
                Commonplace appearance
              </p>
              <div className="grid gap-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 lg:grid-cols-2">
                <CommonplaceThemeSwatches
                  legend="Canvas color"
                  value={selectedCommonplaceCanvasColor}
                  onChange={setSelectedCommonplaceCanvasColor}
                  disabled={isSaving}
                  testId="settings-commonplace-canvas-color"
                />
                <CommonplaceThemeSwatches
                  legend="Card color"
                  value={selectedCommonplaceCardColor}
                  onChange={setSelectedCommonplaceCardColor}
                  disabled={isSaving}
                  testId="settings-commonplace-card-color"
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--brand-ink-soft)]">
                These colors apply only to Commonplace maps, Library cards, and
                sidebar cards.
              </p>
            </div>

            <div className="flex flex-col gap-2 font-sans">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main settings component view
// ---------------------------------------------------------------------------
export function SettingsView({
  isSignedIn,
  appLanguage,
  profile,
  profileLoadError,
  profileSaveStatus,
  profileSaveError,
  onSavePreferences,
  onAppLanguageChange,
  defaultAiProvider = "Claude",
  onDefaultAiProviderChange,
  defaultTtsProvider = "polly",
  onDefaultTtsProviderChange,
  defaultElevenLabsModel = "",
  onDefaultElevenLabsModelChange,
}: SettingsViewProps) {
  const { t } = useI18n(appLanguage);

  const [providerStatus, setProviderStatus] = useState<{
    providers?: {
      Claude: { configured: boolean };
      Gemini: { configured: boolean };
      DeepSeek: { configured: boolean };
    };
    ttsProviders?: {
      Polly: { configured: boolean };
      ElevenLabs: { configured: boolean };
    };
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleCheckStatus() {
    setIsCheckingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/provider-status");
      if (!res.ok) {
        throw new Error("Failed to check status");
      }
      const data = await res.json();
      setProviderStatus(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Error checking status");
    } finally {
      setIsCheckingStatus(false);
    }
  }

  const mainSettingsBlock = !isSignedIn ? (
    <SignedOutSettings t={t} />
  ) : (
    <SignedInSettings
      key={profile?.ownerId ?? "loading"}
      profile={profile}
      profileLoadError={profileLoadError}
      profileSaveStatus={profileSaveStatus}
      profileSaveError={profileSaveError}
      onSavePreferences={onSavePreferences}
      onAppLanguageChange={onAppLanguageChange}
      t={t}
      appLanguage={appLanguage}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {mainSettingsBlock}

      {/* Global AI Provider Card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            AI Configuration
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Default AI Provider
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)] font-sans">
            Choose which server-side AI provider supported features should use. API keys stay on the server and are never stored in the browser.
          </p>
        </div>
        <div className={cardBody}>
          <div className="max-w-xs mb-6">
            <label className="flex flex-col gap-1.5 font-sans">
              <span className="text-xs font-medium text-[var(--brand-ink-soft)]">
                AI Provider
              </span>
              <select
                id="default-ai-provider-select"
                value={defaultAiProvider}
                onChange={(e) => onDefaultAiProviderChange?.(e.target.value as "Claude" | "Gemini" | "DeepSeek")}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
              >
                <option value="Claude">Claude</option>
                <option value="Gemini">Gemini</option>
                <option value="DeepSeek">DeepSeek</option>
              </select>
            </label>
          </div>

          <div className="border-t border-[var(--brand-border)] pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[var(--brand-ink)]">
                Server Provider Status
              </p>
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={isCheckingStatus}
                className="rounded-lg bg-[var(--brand-surface-2)] border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-ink)] hover:bg-[var(--brand-surface)] disabled:opacity-50 transition-colors"
              >
                {isCheckingStatus ? "Checking..." : "Check Status"}
              </button>
            </div>
            
            {statusError && (
              <p className="text-xs text-red-600 mb-3 font-sans">{statusError}</p>
            )}
            
            {providerStatus && (
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--brand-ink)]">Claude</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${providerStatus.providers?.Claude?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {providerStatus.providers?.Claude?.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--brand-ink)]">Gemini</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${providerStatus.providers?.Gemini?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {providerStatus.providers?.Gemini?.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--brand-ink)]">DeepSeek</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${providerStatus.providers?.DeepSeek?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {providerStatus.providers?.DeepSeek?.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--brand-ink)]">AWS Polly (TTS)</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${providerStatus.ttsProviders?.Polly?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {providerStatus.ttsProviders?.Polly?.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--brand-ink)]">ElevenLabs (TTS)</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${providerStatus.ttsProviders?.ElevenLabs?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {providerStatus.ttsProviders?.ElevenLabs?.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TTS Provider Card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            Voice Configuration
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Text-to-Speech Provider
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)] font-sans">
            Choose which server-side voice engine reads AI host responses aloud. API keys stay on the server and are never stored in the browser.
          </p>
        </div>
        <div className={cardBody}>
          <div className="max-w-xs">
            <label className="flex flex-col gap-1.5 font-sans">
              <span className="text-xs font-medium text-[var(--brand-ink-soft)]">
                TTS Provider
              </span>
              <select
                id="default-tts-provider-select"
                value={defaultTtsProvider}
                onChange={(e) =>
                  onDefaultTtsProviderChange?.(e.target.value as "polly" | "elevenlabs")
                }
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
              >
                <option value="polly">AWS Polly</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </label>
          </div>

          {/* ElevenLabs Model Dropdown */}
          {defaultTtsProvider === "elevenlabs" && (
            <div className="mt-4 max-w-xs">
              <label className="flex flex-col gap-1.5 font-sans">
                <span className="text-xs font-medium text-[var(--brand-ink-soft)]">
                  ElevenLabs Model
                </span>
                <select
                  id="default-elevenlabs-model-select"
                  value={defaultElevenLabsModel}
                  onChange={(e) =>
                    onDefaultElevenLabsModelChange?.(
                      e.target.value as "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | ""
                    )
                  }
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
                >
                  <option value="">-- Select a Model --</option>
                  <option value="eleven_flash_v2_5">
                    eleven_flash_v2_5 (Recommended for Podchat / low latency)
                  </option>
                  <option value="eleven_multilingual_v2">
                    eleven_multilingual_v2 (Higher-quality multilingual speech)
                  </option>
                  <option value="eleven_v3">
                    eleven_v3 (Most expressive voice quality)
                  </option>
                </select>
              </label>
            </div>
          )}

          {/* TTS Provider Status Section */}
          <div className="border-t border-[var(--brand-border)] mt-5 pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[var(--brand-ink)] font-sans">
                TTS Provider Status
              </p>
              {!providerStatus && (
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className="rounded-lg bg-[var(--brand-surface-2)] border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-ink)] hover:bg-[var(--brand-surface)] disabled:opacity-50 transition-colors"
                >
                  {isCheckingStatus ? "Checking..." : "Check Status"}
                </button>
              )}
            </div>

            {providerStatus ? (
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 font-sans text-sm">
                <div className="flex items-center justify-between" data-testid="tts-status-polly">
                  <span className="text-[var(--brand-ink)]">AWS Polly</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${providerStatus.ttsProviders?.Polly?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {providerStatus.ttsProviders?.Polly?.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between" data-testid="tts-status-elevenlabs">
                  <span className="text-[var(--brand-ink)]">ElevenLabs</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${providerStatus.ttsProviders?.ElevenLabs?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {providerStatus.ttsProviders?.ElevenLabs?.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--brand-ink-soft)] leading-relaxed">
                  This checks whether server-side voice provider credentials are present. It does not validate quota, billing, or provider availability.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--brand-ink-soft)] font-sans">
                Click Check Status above to verify server credentials.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
