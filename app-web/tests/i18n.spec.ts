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
    expect(t("en", "progress.levelUpCheck")).toBe("Level-Up Check");
    expect(t("en", "progress.statusReady")).toBe("Ready");
    expect(t("en", "review.runBtn")).toBe("Run Weekly Review");
    expect(t("en", "mental.focusWeakness")).toBe("Focus / Weakness");
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
    // New keys verification
    expect(t("id", "progress.levelUpCheck")).toBe("Level-Up Check");
    expect(t("id", "progress.localReadiness")).toBe("Pemeriksaan kesiapan lokal");
    expect(t("id", "progress.statusReady")).toBe("Siap");
    expect(t("id", "review.runBtn")).toBe("Jalankan Tinjauan Mingguan");
    expect(t("id", "mental.focusWeakness")).toBe("Fokus / Kelemahan");
    expect(t("id", "mental.microDrill")).toBe("Latihan Mikro");
  });
});

test.describe("i18n E2E default language", () => {
  test("sidebar, topbar and layouts render in English by default for signed-out users", async ({ page }) => {
    await page.goto("/");

    // Verify initial layout is English
    await expect(page.locator("aside")).toContainText("Settings");
    await expect(page.locator("aside")).toContainText("Active Session");
    await expect(page.locator("header")).toContainText("Active Practice");

    // Navigate to Progress view
    await page.getByRole("button", { name: "Progress" }).click();

    // Verify localized titles inside Progress View render in English
    await expect(page.locator("body")).toContainText("Local readiness check");
    await expect(page.locator("body")).toContainText("Sessions completed");
    await expect(page.locator("body")).toContainText("Practice today to start");
  });
});

