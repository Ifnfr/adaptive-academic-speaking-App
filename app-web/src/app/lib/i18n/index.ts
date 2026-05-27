export const APP_LANGUAGES = ["en", "id"] as const;
export const FEEDBACK_LANGUAGES = ["en", "id"] as const;
export const TARGET_LANGUAGES = ["en"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];
export type FeedbackLanguage = (typeof FEEDBACK_LANGUAGES)[number];
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number];

export const DEFAULT_APP_LANGUAGE: AppLanguage = "en";
export const DEFAULT_FEEDBACK_LANGUAGE: FeedbackLanguage = "en";
export const DEFAULT_TARGET_LANGUAGE: TargetLanguage = "en";

const dictionaries = {
  en: {
    "nav.profileSettings": "Profile & Settings",
    "profile.account": "Account",
    "profile.appLanguage": "App language",
    "profile.bio": "Bio",
    "profile.displayName": "Display name",
    "profile.feedbackLanguage": "Feedback language",
    "profile.languagePreferences": "Language preferences",
    "profile.languagePreferencesComingSoon": "Coming soon",
    "profile.leaderboardOptIn": "Leaderboard opt-in",
    "profile.localProfile": "Local Profile",
    "profile.localStats": "Local Stats",
    "profile.profilePrivacy": "Profile & Privacy",
    "profile.profileSettings": "Profile & Settings",
    "profile.profileSettingsSection": "Profile Settings",
    "profile.publicProfile": "Public profile",
    "profile.saveProfileSettings": "Save profile settings",
    "profile.saved": "Profile settings saved.",
    "profile.saving": "Saving...",
    "profile.targetLanguage": "Target language",
    "profile.yourProgress": "Your Progress",
  },
  id: {
    "nav.profileSettings": "Profil & Pengaturan",
    "profile.account": "Akun",
    "profile.appLanguage": "Bahasa aplikasi",
    "profile.bio": "Bio",
    "profile.displayName": "Nama tampilan",
    "profile.feedbackLanguage": "Bahasa umpan balik",
    "profile.languagePreferences": "Preferensi bahasa",
    "profile.languagePreferencesComingSoon": "Segera hadir",
    "profile.leaderboardOptIn": "Ikut papan peringkat",
    "profile.localProfile": "Profil Lokal",
    "profile.localStats": "Statistik Lokal",
    "profile.profilePrivacy": "Profil & Privasi",
    "profile.profileSettings": "Profil & Pengaturan",
    "profile.profileSettingsSection": "Pengaturan Profil",
    "profile.publicProfile": "Profil publik",
    "profile.saveProfileSettings": "Simpan pengaturan profil",
    "profile.saved": "Pengaturan profil tersimpan.",
    "profile.saving": "Menyimpan...",
    "profile.targetLanguage": "Bahasa target",
    "profile.yourProgress": "Progres Anda",
  },
} as const;

export type I18nKey = keyof (typeof dictionaries)[typeof DEFAULT_APP_LANGUAGE];
export type Translate = (key: I18nKey) => string;

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return includesValue(APP_LANGUAGES, value) ? value : DEFAULT_APP_LANGUAGE;
}

export function normalizeFeedbackLanguage(value: unknown): FeedbackLanguage {
  return includesValue(FEEDBACK_LANGUAGES, value)
    ? value
    : DEFAULT_FEEDBACK_LANGUAGE;
}

export function normalizeTargetLanguage(value: unknown): TargetLanguage {
  return includesValue(TARGET_LANGUAGES, value) ? value : DEFAULT_TARGET_LANGUAGE;
}

export function t(language: unknown, key: I18nKey): string {
  return dictionaries[normalizeAppLanguage(language)][key];
}

export function useI18n(language: unknown = DEFAULT_APP_LANGUAGE): {
  appLanguage: AppLanguage;
  t: Translate;
} {
  const appLanguage = normalizeAppLanguage(language);
  return {
    appLanguage,
    t: (key) => dictionaries[appLanguage][key],
  };
}
