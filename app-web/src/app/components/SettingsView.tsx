"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AuthStatus } from "./AuthStatus";
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
  getCommonplaceCanvasTheme,
  getCommonplaceCardTheme,
  normalizeCommonplaceThemeColorId,
  type CommonplaceThemeColorId,
} from "../lib/commonplace-theme";
import {
  type UserProfile,
  type UserProfilePreferencesPatch,
  type AppAppearanceMode,
  assertAppAppearanceMode,
} from "../lib/storage/supabase-profile-adapter";
import {
  AMAZON_POLLY_VOICE_PROFILES,
  // Kept imported: the (currently unreachable) ElevenLabs model/voice
  // dropdown blocks below still reference the catalog so re-enabling the
  // provider after an account upgrade needs no code archaeology.
  ELEVENLABS_VOICE_CATALOG,
  isElevenLabsVoiceId,
  type ElevenLabsVoiceId,
  type TtsProvider,
  type TtsVoiceProfile,
} from "../lib/tts/voiceProfiles";

// Shared visual primitives from globals.css, scoped here for Settings.
const card = "app-panel brand-grid";
const cardHeader =
  "border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-5 py-4 sm:px-6";
const cardBody = "p-5 sm:p-6";
const settingsPanel = "app-panel-muted px-4 py-4";
const settingsSectionTitle =
  "mb-2 text-sm font-semibold text-[var(--brand-ink)]";

export type SettingsViewProps = {
  isSignedIn: boolean;
  appLanguage?: AppLanguage | null;
  profile: UserProfile | null;
  profileLoadError: string | null;
  profileSaveStatus: "idle" | "saving" | "saved" | "error";
  profileSaveError: string | null;
  onSavePreferences: (patch: UserProfilePreferencesPatch) => void;
  onAppLanguageChange?: (language: AppLanguage) => void;
  podchatProvider?: string;
  onPodchatProviderChange?: (provider: "Claude" | "Gemini" | "DeepSeek" | "OpenCode" | "Hermes" | "TokenRouter" | "RouteAPI") => void;
  listeningProvider?: string;
  onListeningProviderChange?: (provider: "Claude" | "Gemini" | "DeepSeek" | "OpenCode" | "Hermes" | "TokenRouter" | "RouteAPI") => void;
  fluencyProvider?: string;
  onFluencyProviderChange?: (provider: "Claude" | "Gemini" | "DeepSeek" | "OpenCode" | "Hermes" | "TokenRouter" | "RouteAPI") => void;
  defaultTtsProvider?: TtsProvider;
  onDefaultTtsProviderChange?: (provider: TtsProvider) => void;
  defaultTtsVoiceProfile?: TtsVoiceProfile;
  onDefaultTtsVoiceProfileChange?: (profile: TtsVoiceProfile) => void;
  defaultElevenLabsModel?: "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "";
  onDefaultElevenLabsModelChange?: (model: "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "") => void;
  defaultElevenLabsVoice?: ElevenLabsVoiceId | "";
  onDefaultElevenLabsVoiceChange?: (voice: ElevenLabsVoiceId | "") => void;
  stopAiOnSpeechEnabled?: boolean;
  onStopAiOnSpeechEnabledChange?: (enabled: boolean) => void;
  autoSendOnPauseEnabled?: boolean;
  onAutoSendOnPauseEnabledChange?: (enabled: boolean) => void;
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

function providerStatusTone(configured: boolean): string {
  return configured ? "app-status-success" : "app-status-error";
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
  appearanceMode,
}: {
  displayName: string;
  bio: string;
  publicProfileEnabled: boolean;
  leaderboardOptIn: boolean;
  preferredAppLanguage: AppLanguage;
  feedbackLanguage: FeedbackLanguage;
  commonplaceCanvasColor?: CommonplaceThemeColorId;
  commonplaceCardColor?: CommonplaceThemeColorId;
  appearanceMode?: AppAppearanceMode;
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
    appearanceMode: assertAppAppearanceMode(appearanceMode),
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
    <div className="flex items-start gap-4 border-b border-[var(--brand-border)] py-3 last:border-b-0">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block cursor-pointer text-sm font-semibold text-[var(--brand-ink)]"
        >
          {label}
        </label>
        <p className="app-helper mt-0.5">{description}</p>
      </div>
      <div className="min-h-[44px] flex items-center">
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
            "transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            checked
              ? "bg-[var(--brand-accent-fill)]"
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
      <span className="app-label">
        {label}
      </span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="app-field"
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
      <legend className="app-label">
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
                "flex min-h-[4.5rem] flex-col items-start justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-[var(--brand-accent-fill)] bg-[var(--brand-accent-fill)] text-[var(--brand-accent-fill-ink)]"
                  : "border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink)] hover:border-[var(--brand-teal)]/40 hover:bg-[var(--brand-surface-2)]",
              ].join(" ")}
              data-testid={`${testId}-option-${choice.id}`}
            >
              <span
                className="h-6 w-6 rounded-full border border-black/10 shadow-inner"
                style={{ backgroundColor: choice.swatch }}
                aria-hidden="true"
              />
              <span className="leading-4">
                {choice.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ProviderStatusRow({
  label,
  configured,
  testId,
}: {
  label: string;
  configured: boolean;
  testId?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      data-testid={testId}
    >
      <span className="min-w-0 text-sm text-[var(--brand-ink)]">{label}</span>
      <span className={`app-status ${providerStatusTone(configured)}`}>
        {configured ? "Configured" : "Missing"}
      </span>
    </div>
  );
}

function CommonplaceAppearancePreview({
  canvasColor,
  cardColor,
}: {
  canvasColor: CommonplaceThemeColorId;
  cardColor: CommonplaceThemeColorId;
}) {
  const canvasTheme = useMemo(
    () => getCommonplaceCanvasTheme(canvasColor),
    [canvasColor],
  );
  const cardTheme = useMemo(
    () => getCommonplaceCardTheme(cardColor),
    [cardColor],
  );

  return (
    <div
      className="app-panel-muted p-3"
      data-testid="settings-commonplace-appearance-preview"
    >
      <div
        className="overflow-hidden rounded-lg border"
        data-commonplace-panel-surface="true"
        data-testid="settings-commonplace-canvas-preview"
        style={canvasTheme.panelStyle}
      >
        <div
          className="relative h-36"
          style={canvasTheme.mainBackgroundStyle}
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `linear-gradient(${canvasTheme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${canvasTheme.gridColor} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
            aria-hidden="true"
          />
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-[var(--commonplace-panel-border)] bg-white/85 px-2.5 py-1 text-[11px] font-semibold commonplace-panel-ink">
            Canvas
          </div>
          <div className="absolute left-10 top-20 h-3 w-3 rounded-full bg-[var(--commonplace-panel-accent)] shadow-sm" />
          <div className="absolute left-28 top-12 h-3 w-3 rounded-full bg-[var(--commonplace-panel-accent)] shadow-sm" />
          <div className="absolute left-44 top-24 h-3 w-3 rounded-full bg-[var(--commonplace-panel-accent)] shadow-sm" />
          <svg
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            viewBox="0 0 280 144"
            preserveAspectRatio="none"
          >
            <path
              d="M52 84 C90 44, 112 42, 126 56"
              fill="none"
              stroke="var(--commonplace-panel-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
            <path
              d="M140 60 C166 80, 178 92, 198 96"
              fill="none"
              stroke="var(--commonplace-panel-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
        </div>
      </div>

      <div
        className="mt-3 overflow-hidden rounded-lg border shadow-sm"
        data-commonplace-card-surface="true"
        data-testid="settings-commonplace-card-preview"
        style={cardTheme.style}
      >
        <div className="px-3 py-2.5">
          <p className="commonplace-card-ink text-sm font-semibold">
            Preview note card
          </p>
          <p className="commonplace-card-ink-soft mt-1 line-clamp-2 text-xs leading-5">
            A compact note surface with its own color and readable ink.
          </p>
          <span
            className="commonplace-card-tag mt-2 inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold"
            style={cardTheme.tagStyle}
          >
            #cp1
          </span>
        </div>
        <div
          className="border-t px-3 py-1.5 text-right"
          data-commonplace-card-surface="true"
          style={cardTheme.footerStyle}
        >
          <span className="commonplace-card-accent font-mono text-[11px] font-semibold">
            Library card
          </span>
        </div>
      </div>
    </div>
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
          <p className="app-label text-[var(--brand-gold)]">
            {t("profile.localProfile")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("profile.profileSettings")}
          </h2>
          <p className="app-helper mt-1">
            You are using fonetik in local mode.
          </p>
        </div>
        <div className={cardBody}>
          <div className="app-message app-message-info">
            <p className="text-sm font-medium text-[var(--brand-ink)]">
              Learning data stays on this browser
            </p>
            <p className="mt-2">
              Your sessions, vocabulary, XP, and badges are stored only in this
              browser&apos;s local storage. No account is required to practice.
            </p>
            <p className="mt-4">
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
  const [selectedAppearanceMode, setSelectedAppearanceMode] =
    useState<AppAppearanceMode>(
      assertAppAppearanceMode(profile?.appearanceMode),
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
        appearanceMode: selectedAppearanceMode,
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
          <p className="app-label text-[var(--brand-gold)]">
            {t("profile.account")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {t("profile.profileSettings")}
          </h2>
        </div>
        <div className={cardBody}>
          {profileLoadError && (
            <div
              className="app-message app-message-error mb-4"
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
          <p className="app-label text-[var(--brand-gold)]">
            {t("profile.profileSettingsSection")}
          </p>
          <h3 className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
            {t("profile.profilePrivacy")}
          </h3>
          <p className="app-helper mt-1">
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
                className="app-label mb-1.5"
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
                className="app-field"
                placeholder="Your display name"
              />
            </div>

            {/* Bio field */}
            <div>
              <label
                htmlFor="profile-bio-input"
                className="app-label mb-1.5"
              >
                {t("profile.bio")}
                <span className="ml-1 font-mono text-xs font-normal text-[var(--brand-muted)]">
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
                className="app-field resize-none"
                placeholder="A short note about your learning goals (optional)"
              />
            </div>

            {/* Privacy switches */}
            <div>
              <p className={settingsSectionTitle}>
                Sharing &amp; privacy
              </p>
              <div className={`${settingsPanel} divide-y divide-[var(--brand-border)] py-0`}>
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
              <p className={settingsSectionTitle}>
                {t("profile.languagePreferences")}
              </p>
              <div className={`${settingsPanel} grid gap-3 sm:grid-cols-3`}>
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
                  <span className="app-label">
                    {t("profile.targetLanguage")}
                  </span>
                  <select
                    id="profile-target-language-select"
                    value={selectedTargetLanguage}
                    disabled
                    className="app-field"
                  >
                    <option value={DEFAULT_TARGET_LANGUAGE}>
                      {t("profile.english")}
                    </option>
                  </select>
                  <span className="app-helper text-[11px]">
                    {t("profile.targetLanguageFixed")}
                  </span>
                </label>
              </div>
            </div>

            {/* Actions & Status */}
            <div>
              <p className={settingsSectionTitle}>
                Commonplace appearance
              </p>
              <div className={`${settingsPanel} grid gap-4 lg:grid-cols-2`}>
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
                <div className="lg:col-span-2">
                  <CommonplaceAppearancePreview
                    canvasColor={selectedCommonplaceCanvasColor}
                    cardColor={selectedCommonplaceCardColor}
                  />
                </div>
              </div>
              <p className="app-helper mt-2">
                These colors apply only to Commonplace maps, Library cards, and
                sidebar cards.
              </p>
            </div>

            {/* Global Appearance Section */}
            <div>
              <p className={settingsSectionTitle}>
                App appearance
              </p>
              <div className={`${settingsPanel} grid gap-3 sm:grid-cols-3`}>
                <label className="flex flex-col gap-1.5 font-sans">
                  <span className="app-label">
                    Theme mode
                  </span>
                  <select
                    id="profile-appearance-mode-select"
                    value={selectedAppearanceMode}
                    disabled={isSaving}
                    onChange={(e) => setSelectedAppearanceMode(e.target.value as AppAppearanceMode)}
                    className="app-field"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 font-sans sm:items-start">
              <button
                id="profile-save-btn"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="app-button app-button-primary"
              >
                {isSaving ? t("profile.saving") : t("profile.saveProfileSettings")}
              </button>

              {profileSaveStatus === "saved" && (
                <p
                  className="app-message app-message-success w-full"
                  data-testid="profile-save-success"
                >
                  {t("profile.saved")}
                </p>
              )}
              {profileSaveStatus === "error" && profileSaveError && (
                <p
                  className="app-message app-message-error w-full"
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
  podchatProvider = "Claude",
  onPodchatProviderChange,
  listeningProvider = "Gemini",
  onListeningProviderChange,
  fluencyProvider = "DeepSeek",
  onFluencyProviderChange,
  defaultTtsProvider = "amazon-polly",
  onDefaultTtsProviderChange,
  defaultTtsVoiceProfile = "british_male",
  onDefaultTtsVoiceProfileChange,
  defaultElevenLabsModel = "",
  onDefaultElevenLabsModelChange,
  defaultElevenLabsVoice = "",
  onDefaultElevenLabsVoiceChange,
  stopAiOnSpeechEnabled = true,
  onStopAiOnSpeechEnabledChange,
  autoSendOnPauseEnabled = true,
  onAutoSendOnPauseEnabledChange,
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

      {/* Model Selection Card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="app-label text-[var(--brand-teal)]">
            Model Selection
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            AI Provider Routing
          </h2>
          <p className="app-helper mt-1">
            Assign different AI execution providers to optimize cognitive and speed requirements per feature.
          </p>
        </div>
        <div className={cardBody}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-6">
            <label className="flex flex-col gap-1.5 font-sans">
              <span className="app-label">
                Podchat Provider
              </span>
              <select
                id="podchat-provider-select"
                value={podchatProvider}
                onChange={(e) => onPodchatProviderChange?.(e.target.value as "Claude" | "Gemini" | "DeepSeek" | "OpenCode" | "Hermes" | "TokenRouter" | "RouteAPI")}
                className="app-field"
              >
                <option value="Claude">Claude (Slower, precise Socratic coaching)</option>
                <option value="Gemini">Gemini (Fast, multimodal, flexible)</option>
                <option value="DeepSeek">DeepSeek (Cost-efficient, smart context bridge)</option>
                <option value="OpenCode">OpenCode (via opencode.ai, cloud AI)</option>
                <option value="Hermes">Hermes (Local Agent, always available)</option>
                <option value="TokenRouter">TokenRouter (API Proxy, DeepSeek Flash)</option>
                <option value="RouteAPI">RouteAPI (API Proxy, DeepSeek Flash)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 font-sans">
              <span className="app-label">
                Listening Provider
              </span>
              <select
                id="listening-provider-select"
                value={listeningProvider}
                onChange={(e) => onListeningProviderChange?.(e.target.value as "Claude" | "Gemini" | "DeepSeek" | "OpenCode" | "Hermes" | "TokenRouter" | "RouteAPI")}
                className="app-field"
              >
                <option value="Claude">Claude (Detailed exercise planning)</option>
                <option value="Gemini">Gemini (Fast, high-fidelity audio mapping)</option>
                <option value="DeepSeek">DeepSeek (Swift reasoning & cost efficiency)</option>
                <option value="OpenCode">OpenCode (via opencode.ai, cloud AI)</option>
                <option value="Hermes">Hermes (Local Agent, always available)</option>
                <option value="TokenRouter">TokenRouter (API Proxy, DeepSeek Flash)</option>
                <option value="RouteAPI">RouteAPI (API Proxy, DeepSeek Flash)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 font-sans">
              <span className="app-label">
                Fluency Provider
              </span>
              <select
                id="fluency-provider-select"
                value={fluencyProvider}
                onChange={(e) => onFluencyProviderChange?.(e.target.value as "Claude" | "Gemini" | "DeepSeek" | "OpenCode" | "Hermes" | "TokenRouter" | "RouteAPI")}
                className="app-field"
              >
                <option value="Claude">Claude (Advanced debate & argument coach)</option>
                <option value="Gemini">Gemini (Ultra-low latency fluency drills)</option>
                <option value="DeepSeek">DeepSeek (Default, balanced grammar corrections)</option>
                <option value="OpenCode">OpenCode (via opencode.ai, cloud AI)</option>
                <option value="Hermes">Hermes (Local Agent, always available)</option>
                <option value="TokenRouter">TokenRouter (API Proxy, DeepSeek Flash)</option>
                <option value="RouteAPI">RouteAPI (API Proxy, DeepSeek Flash)</option>
              </select>
            </label>
          </div>

          <div className="border-t border-[var(--brand-border)] pt-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-[var(--brand-ink)]">
                Server Provider Status
              </p>
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={isCheckingStatus}
                className="app-button app-button-secondary min-h-9 px-3 py-1.5 text-xs"
              >
                {isCheckingStatus ? "Checking..." : "Check Status"}
              </button>
            </div>
            
            {statusError && (
              <p className="app-message app-message-error mb-3">{statusError}</p>
            )}
            
            {providerStatus && (
              <div className={`${settingsPanel} flex flex-col gap-3 font-sans`}>
                <ProviderStatusRow
                  label="Claude"
                  configured={providerStatus.providers?.Claude?.configured === true}
                />
                <ProviderStatusRow
                  label="Gemini"
                  configured={providerStatus.providers?.Gemini?.configured === true}
                />
                <ProviderStatusRow
                  label="DeepSeek"
                  configured={providerStatus.providers?.DeepSeek?.configured === true}
                />
                <ProviderStatusRow
                  label="AWS Polly (TTS)"
                  configured={providerStatus.ttsProviders?.Polly?.configured === true}
                />
                <ProviderStatusRow
                  label="ElevenLabs (TTS)"
                  configured={providerStatus.ttsProviders?.ElevenLabs?.configured === true}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TTS Provider Card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="app-label text-[var(--brand-teal)]">
            Voice Configuration
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Text-to-Speech Provider
          </h2>
          <p className="app-helper mt-1">
            Choose which server-side voice engine reads AI host responses aloud. API keys stay on the server and are never stored in the browser.
          </p>
        </div>
        <div className={cardBody}>
          <div className="max-w-xs">
            <label className="flex flex-col gap-1.5 font-sans">
              <span className="app-label">
                TTS Provider
              </span>
              <select
                id="default-tts-provider-select"
                value={defaultTtsProvider}
                onChange={(e) =>
                  onDefaultTtsProviderChange?.(e.target.value as TtsProvider)
                }
                className="app-field"
              >
                <option value="amazon-polly">Amazon Polly</option>
                {/* ElevenLabs is temporarily hidden from selection: the account
                    is on the free tier and the ElevenLabs API rejects every
                    text-to-speech call with 402 paid_plan_required. The full
                    pipeline stays wired end-to-end; restore this option (and
                    the normalizeTtsProvider coercion) once the account is on a
                    paid plan. */}
              </select>
            </label>
          </div>

          {defaultTtsProvider === "amazon-polly" && (
            <div className="mt-4 max-w-xs">
              <label className="flex flex-col gap-1.5 font-sans">
                <span className="app-label">
                  TTS Voice Profile
                </span>
                <select
                  id="default-tts-voice-profile-select"
                  value={defaultTtsVoiceProfile}
                  onChange={(e) =>
                    onDefaultTtsVoiceProfileChange?.(e.target.value as TtsVoiceProfile)
                  }
                  className="app-field"
                >
                  {Object.entries(AMAZON_POLLY_VOICE_PROFILES).map(([value, profile]) => (
                    <option key={value} value={value}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="app-helper mt-2">
                The browser stores only this profile ID. The server maps it to the approved Amazon Polly voice.
              </p>
            </div>
          )}

          {/* ElevenLabs Model Dropdown */}
          {defaultTtsProvider === "elevenlabs" && (
            <div className="mt-4 max-w-xs">
              <label className="flex flex-col gap-1.5 font-sans">
                <span className="app-label">
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
                  className="app-field"
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

          {/* ElevenLabs Voice Dropdown */}
          {defaultTtsProvider === "elevenlabs" && (
            <div className="mt-4 max-w-xs">
              <label className="flex flex-col gap-1.5 font-sans">
                <span className="app-label">
                  ElevenLabs Voice
                </span>
                <select
                  id="default-elevenlabs-voice-select"
                  value={defaultElevenLabsVoice}
                  onChange={(e) => {
                    const next = e.target.value;
                    onDefaultElevenLabsVoiceChange?.(
                      isElevenLabsVoiceId(next) ? next : "",
                    );
                  }}
                  className="app-field"
                >
                  <option value="">Use server default voice</option>
                  {Object.entries(ELEVENLABS_VOICE_CATALOG).map(([value, voice]) => (
                    <option key={value} value={value}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="app-helper mt-2">
                The browser stores only this voice ID. The server maps it to the approved ElevenLabs
                voice; leaving it unset uses the server&apos;s configured default.
              </p>
            </div>
          )}

          {/* TTS Provider Status Section */}
          <div className="border-t border-[var(--brand-border)] mt-5 pt-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-[var(--brand-ink)] font-sans">
                TTS Provider Status
              </p>
              {!providerStatus && (
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className="app-button app-button-secondary min-h-9 px-3 py-1.5 text-xs"
                >
                  {isCheckingStatus ? "Checking..." : "Check Status"}
                </button>
              )}
            </div>

            {providerStatus ? (
              <div className={`${settingsPanel} flex flex-col gap-3 font-sans text-sm`}>
                <ProviderStatusRow
                  label="AWS Polly"
                  configured={providerStatus.ttsProviders?.Polly?.configured === true}
                  testId="tts-status-polly"
                />
                <ProviderStatusRow
                  label="ElevenLabs"
                  configured={providerStatus.ttsProviders?.ElevenLabs?.configured === true}
                  testId="tts-status-elevenlabs"
                />
                <p className="app-helper mt-1">
                  This checks whether server-side voice provider credentials are present. It does not validate quota, billing, or provider availability.
                </p>
              </div>
            ) : (
              <p className="app-helper font-sans">
                Click Check Status above to verify server credentials.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Podchat Live Mode Card */}
      <div className={card}>
        <div className={cardHeader}>
          <p className="app-label text-[var(--brand-teal)]">
            Podchat Live Mode
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Speaking Session Behavior
          </h2>
          <p className="app-helper mt-1">
            Tune how live Podchat speaking sessions behave. These preferences are stored only in this browser.
          </p>
        </div>
        <div className={cardBody}>
          <Toggle
            id="toggle-stop-ai-on-speech"
            label="Stop AI host when I start speaking"
            description="Stops host voice playback the moment you begin recording, so you can speak without waiting for the host to finish."
            checked={stopAiOnSpeechEnabled}
            onChange={(v) => onStopAiOnSpeechEnabledChange?.(v)}
          />
          <Toggle
            id="toggle-auto-send-on-pause"
            label="Auto-send my answer when I stop recording"
            description="Automatically submits your transcript for a host reply when you stop recording, instead of requiring a manual send."
            checked={autoSendOnPauseEnabled}
            onChange={(v) => onAutoSendOnPauseEnabledChange?.(v)}
          />
        </div>
      </div>

      {/* Sign Out Card */}
      {isSignedIn && (
        <div className={card}>
          <div className="p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-[var(--brand-ink)]">
              Sign Out
            </h2>
            <div className="border-t border-[var(--brand-border)] pt-4 flex items-center justify-between">
              <span className="text-sm text-[var(--brand-ink-soft)]">
                Logged in as
              </span>
              <AuthStatus />
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone Card */}
      {isSignedIn && <ResetUsageDataSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danger Zone — Reset All Usage Data
// ---------------------------------------------------------------------------
const RESET_LOCAL_STORAGE_KEYS = [
  "adaptive-speaking-app:sessions",
  "adaptive-speaking-app:vocabulary",
  "adaptive-speaking-app:xp-profile",
  "adaptive-speaking-app:xp-events",
  "adaptive-speaking-app:badges",
  ] as const;

const CONFIRM_PHRASE = "DELETE";

function ResetUsageDataSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConfirmed = confirmText.trim() === CONFIRM_PHRASE;

  const openDialog = useCallback(() => {
    setConfirmText("");
    setResetError(null);
    setDialogOpen(true);
    // Focus input after animation frame
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeDialog = useCallback(() => {
    if (isResetting) return; // Block dismiss while request is in-flight
    setDialogOpen(false);
    setConfirmText("");
    setResetError(null);
  }, [isResetting]);

  const handleReset = useCallback(async () => {
    if (!isConfirmed || isResetting) return;
    setIsResetting(true);
    setResetError(null);

    try {
      const res = await fetch("/api/account/reset-usage-data", {
        method: "POST",
      });

      if (!res.ok) {
        let detail = `Request failed with status ${res.status}.`;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
          else if (body?.error) detail = body.error;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(detail);
      }

      // Backend succeeded — now clear the local browser data
      if (typeof window !== "undefined") {
        for (const key of RESET_LOCAL_STORAGE_KEYS) {
          window.localStorage.removeItem(key);
        }
        window.location.reload();
      }
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
      );
      setIsResetting(false);
    }
  }, [isConfirmed, isResetting]);

  return (
    <>
      {/* Danger Zone card */}
      <div className="app-panel border border-[var(--brand-coral)]/40 bg-[var(--brand-coral-soft)]/30">
        <div className="border-b border-[var(--brand-coral)]/20 bg-[var(--brand-coral-soft)]/50 px-5 py-4 sm:px-6">
          <p className="app-label text-[var(--brand-coral)]">
            Danger Zone
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            Reset All Usage Data
          </h2>
          <p className="app-helper mt-1">
            Permanently and irreversibly delete all your learning history from this account.
            Your account settings — profile, language, theme, TTS voice, and provider choices — are not affected.
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-[var(--brand-ink)]">What gets deleted:</p>
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--brand-ink-soft)] list-none">
                {[
                  "Speaking sessions & feedback",
                  "XP, badges & progress",
                  "Vocabulary notebook",
                  "Listening exercise history & audio files",
                  "Podchat & article writing history",
                  "Commonplace notes & mind maps",
                  "Weekly reviews & mission logs",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <span className="text-[var(--brand-coral)] font-bold">×</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <button
              id="reset-usage-data-open-btn"
              type="button"
              onClick={openDialog}
              className="shrink-0 rounded-xl border border-[var(--brand-coral)]/60 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-coral)] shadow-sm transition-all hover:bg-[var(--brand-coral-soft)] active:scale-[0.97]"
            >
              Reset All Data…
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {dialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeDialog}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--brand-coral)]/40 bg-[var(--brand-surface)] shadow-2xl">
            {/* Header */}
            <div className="border-b border-[var(--brand-border)] bg-[var(--brand-coral-soft)]/40 px-6 py-5 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-coral)] text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <h3 id="reset-dialog-title" className="text-base font-semibold text-[var(--brand-ink)]">
                    Delete All Usage Data
                  </h3>
                  <p className="text-xs text-[var(--brand-ink-soft)] mt-0.5">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              <p className="text-sm text-[var(--brand-ink-soft)] leading-relaxed">
                This will permanently delete your <strong className="text-[var(--brand-ink)]">speaking sessions, XP, vocabulary, badges, listening/podchat/writing history, commonplace notes and mind maps, weekly reviews,</strong> and all <strong className="text-[var(--brand-ink)]">generated listening audio files</strong>.
              </p>
              <p className="text-sm text-[var(--brand-ink-soft)] leading-relaxed">
                Your <strong className="text-[var(--brand-ink)]">account settings</strong> — profile, language preferences, theme, TTS voice, and AI provider choices — <strong className="text-[var(--brand-ink)]">will not be affected</strong>.
              </p>

              <div className="rounded-xl bg-[var(--brand-coral-soft)]/60 border border-[var(--brand-coral)]/30 p-3">
                <p className="text-xs font-semibold text-[var(--brand-coral)] uppercase tracking-wide mb-2">
                  Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
                </p>
                <input
                  ref={inputRef}
                  id="reset-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  disabled={isResetting}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm font-mono text-[var(--brand-ink)] placeholder-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-coral)]/50 disabled:opacity-50"
                />
              </div>

              {resetError && (
                <p className="app-message app-message-error text-xs">
                  {resetError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--brand-border)] px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                id="reset-dialog-cancel-btn"
                type="button"
                onClick={closeDialog}
                disabled={isResetting}
                className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink-soft)] transition-all hover:bg-[var(--brand-surface-2)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="reset-dialog-confirm-btn"
                type="button"
                onClick={handleReset}
                disabled={!isConfirmed || isResetting}
                className="rounded-xl bg-[var(--brand-coral)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isResetting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
