import { expect, test } from "@playwright/test";
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_FEEDBACK_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  normalizeAppLanguage,
  normalizeFeedbackLanguage,
  normalizeTargetLanguage,
  t,
} from "../src/app/lib/i18n";

test.describe("i18n language foundation", () => {
  test("unknown and null language values normalize to safe defaults", () => {
    expect(normalizeAppLanguage(null)).toBe(DEFAULT_APP_LANGUAGE);
    expect(normalizeAppLanguage("fr")).toBe(DEFAULT_APP_LANGUAGE);
    expect(normalizeFeedbackLanguage(undefined)).toBe(DEFAULT_FEEDBACK_LANGUAGE);
    expect(normalizeFeedbackLanguage("ja")).toBe(DEFAULT_FEEDBACK_LANGUAGE);
    expect(normalizeTargetLanguage("id")).toBe(DEFAULT_TARGET_LANGUAGE);
  });

  test("default translations resolve to English", () => {
    expect(t(null, "nav.profileSettings")).toBe("Profile & Settings");
    expect(t(undefined, "profile.localStats")).toBe("Local Stats");
    expect(t("fr", "profile.saveProfileSettings")).toBe(
      "Save profile settings",
    );
  });

  test("Indonesian dictionary returns Indonesian labels for wired keys", () => {
    expect(normalizeAppLanguage("id")).toBe("id");
    expect(t("id", "nav.profileSettings")).toBe("Profil & Pengaturan");
    expect(t("id", "profile.localStats")).toBe("Statistik Lokal");
    expect(t("id", "profile.languagePreferences")).toBe("Preferensi bahasa");
    expect(t("id", "profile.saveProfileSettings")).toBe(
      "Simpan pengaturan profil",
    );
    expect(t("id", "profile.appLanguage")).toBe("Bahasa aplikasi");
    expect(t("id", "profile.feedbackLanguage")).toBe("Bahasa umpan balik");
    expect(t("id", "profile.targetLanguageFixed")).toBe(
      "Saat ini hanya bahasa Inggris",
    );
  });
});
