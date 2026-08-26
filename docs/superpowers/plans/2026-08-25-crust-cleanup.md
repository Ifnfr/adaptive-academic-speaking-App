# Crust Cleanup (Fonetik) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus crust terverifikasi di `adaptive-academic-speaking-app/app-web` — komponen/lib mati, satu API route tanpa pemanggil, dan satu tautan rusak — TANPA merusak apa pun yang hidup di produksi.

**Architecture:** Deletions murni berbasis bukti referensi-silang (grep literal + template-literal + dynamic-import di seluruh `src/`, `tests/`, config, dan docs). Setiap task punya *pre-delete grep gate* yang wajib lolos sebelum `git rm`, lalu gerbang mekanis penuh (`tsc --noEmit`, `next build`, suite Playwright terdampak) sebelum commit. Daftar "terbukti HIDUP — jangan sentuh" dikunci di Global Constraints.

**Tech Stack:** Next.js 16 App Router (Turbopack), TypeScript strict, Playwright (@playwright/test) untuk unit-route dan browser tests, git bash di Windows (MSYS).

**Spec:** Investigasi crust 2026-08-25 (hasil pemindaian terverifikasi di sesi Hermes; ringkasan bukti tertanam di setiap task). Tidak ada design doc eksternal — plan ini adalah spesifikasinya.

## Global Constraints

- **DAFTAR HIDUP — JANGAN DIHAPUS** (sudah diverifikasi berguna):
  - `src/app/api/cron/cleanup-listening/route.ts` — terdaftar di `vercel.json` → `crons[0].path`, jadwal `0 3 * * *`.
  - `src/app/api/listening-exercise/session/[sessionId]/{status,review,complete,sections/[sectionId]/submit}/route.ts` — dipanggil via template literal dari `src/app/components/listening-exercise/ListeningExerciseSession.tsx` (baris ±216, 368-369, 423) dan di-mock di `tests/listening-exercise/e2e-isolation.spec.ts`.
  - `src/app/api/word-builder/history/[sessionId]/route.ts` — dipanggil via template literal dari `app/word-builder/history/[sessionId]/page.tsx`.
  - `components/{LeaderboardView,SessionLogView,VocabularyNotebookView}.tsx` — dimuat via `dynamic(import(...))` dan dirender di `page.tsx`.
  - `src/app/api/podchat/quiz/route.ts` — dipakai `PodchatView.tsx`.
  - Semua halaman (`/`, `/listening`, `/word-builder/*`) terverifikasi dapat dijangkau dari navigasi.
- **Gerbang wajib tiap task** (dari `app-web/`): `npx tsc --noEmit` bersih; `npx next build` sukses; suite Playwright yang disebut lulus dengan jumlah gagal TIDAK LEBIH dari baseline tercatat: `tests/podchat-tts-route.spec.ts` = 31 lulus / 10 gagal-waris (stale voice-profile names); `tests/mvp-smoke.spec.ts` Test B dan `tests/podchat-ui.spec.ts` gagal di SETUP karena overlay intercept — warisan, abaikan.
- Jika `tsc` mengeluh tentang `.next/dev/types/*.d.ts` (korupsi Turbopack): `rm -rf .next` lalu ulangi. Itu bug tooling, BUKAN kode kita. Jangan pernah edit file hasil generate.
- Hygiene EOL: semua file target LF murni. Edit massal python wajib mode biner. Setelah staging, cek `git diff --cached --stat`: file dengan ribuan perubahan untuk edit kecil = EOL flip → batalkan dan perbaiki.
- Jangan pernah stage: `.next/`, `.hermes/`, `.env.local`.
- Pesan commit konvensional (`feat|chore|fix|test(scope): ...`), satu commit per task.
- Bahasa laporan ke user: Indonesia. Kode/komentar: Inggris.
- Working directory semua command: `C:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web` (kecuali disebut lain).

---

### Task 1: Hapus 11 komponen mati (zero-reference terverifikasi)

**Files:**
- Delete: `src/app/components/AttemptResultPanels.tsx` (384 baris)
- Delete: `src/app/components/Aurora.tsx` (210)
- Delete: `src/app/components/CoachPanels.tsx` (164)
- Delete: `src/app/components/CommonplaceMainMindMapCanvas.tsx` (653)
- Delete: `src/app/components/CommonplaceMindMapCanvas.tsx` (840)
- Delete: `src/app/components/archive/LearningPathUiArchive.tsx` (356) *(path dikoreksi 2026-08-26; semula salah tulis tanpa subfolder)*
- Delete: `src/app/components/learning-path/MicroLessonShell.tsx` (274) *(path dikoreksi 2026-08-26)*
- Delete: `src/app/components/RetryAndSummaryPanels.tsx` (211)
- Delete: `src/app/components/SessionSetup.tsx` (222)
- Delete: `src/app/components/SpeakingAttemptCard.tsx` (183)
- Delete: `src/app/components/SpeakingPromptCard.tsx` (112)

**Interfaces:**
- Consumes: tidak ada (semuanya zero-import terverifikasi — nama file tidak muncul sebagai import maupun string di seluruh `src/`, `tests/`, config, docs).
- Produces: repo tanpa 11 berkas tersebut; task berikutnya mengandalkan `git log --oneline -1 -- <path>` riwayat ini saat audit ulang.

- [ ] **Step 1: Pre-delete safety gate — umur berkas**

Jalankan per berkas (contoh untuk yang pertama; ulangi 11x):
```bash
git log -1 --format="%h %ad %s" --date=short -- src/app/components/Aurora.tsx
```
Expected: commit terakhir lebih tua dari ~14 hari ATAU pesannya jelas arsip ("Disable...", "archive", dsb). Jika ada berkas yang BARU dimodifikasi <14 hari dengan pesan fitur aktif — STOP task ini untuk berkas itu saja, catat, lanjutkan sisanya.

- [ ] **Step 2: Pre-delete grep gate — nol referensi**

```bash
for n in AttemptResultPanels Aurora CoachPanels CommonplaceMainMindMapCanvas CommonplaceMindMapCanvas LearningPathUiArchive MicroLessonShell RetryAndSummaryPanels SessionSetup SpeakingAttemptCard SpeakingPromptCard; do
  echo "== $n ==";
  grep -rn "$n" src/ tests/ *.json *.md 2>/dev/null | grep -v "components/$n.tsx:" || echo "CLEAN";
done
```
Expected: setiap nama mencetak `CLEAN` (atau hanya baris milik berkasnya sendiri). Jika ADA baris lain: berkas itu HIDUP — keluarkan dari daftar hapus, laporkan di commit body.

- [ ] **Step 3: Hapus berkas**

```bash
git rm src/app/components/{AttemptResultPanels,Aurora,CoachPanels,CommonplaceMainMindMapCanvas,CommonplaceMindMapCanvas,LearningPathUiArchive,MicroLessonShell,RetryAndSummaryPanels,SessionSetup,SpeakingAttemptCard,SpeakingPromptCard}.tsx
```

- [ ] **Step 4: Gerbang mekanis**

Run: `npx tsc --noEmit && npx next build`
Expected: keduanya exit 0 (tsc bersih; build menampilkan daftar rute seperti biasa).

- [ ] **Step 5: Suite regresi terdampak**

Run: `npx playwright test tests/commonplace-ui.spec.ts tests/commonplace-schema.spec.ts tests/settings-view.spec.ts tests/profile-view.spec.ts --reporter=line`
Expected: semua PASS (komponen yang dihapus tidak dirujuk spec mana pun — jika ada yang gagal karena merujuk berkas terhapus, itu temuan: hentikan, selidiki apakah spec-nya juga mati, laporkan sebelum lanjut).

- [ ] **Step 6: Commit**

```bash
git commit -m "chore(cleanup): remove 11 dead components (zero references)

Verified via cross-repo grep (src, tests, configs, docs): no import,
dynamic-import, or string reference targets any of these files.
Gates: tsc clean, next build ok, commonplace/settings/profile suites pass."
```

---

### Task 2: Hapus 3 lib mati

**Files:**
- Delete: `src/app/lib/deepseek-endpoint.ts` (9 baris)
- Delete: `src/app/lib/speaking-prompt.ts` (177 baris)
- Delete: `src/app/lib/coach.ts` (111 baris)

**Interfaces:**
- Consumes: hasil Task 1 (repo sudah bebas komponen mati).
- Produces: tidak ada konsumen tersisa yang mereferensikan ketiganya; penting untuk Task 5 (laporan total baris dibersihkan).

- [ ] **Step 1: Pre-delete grep gate**

```bash
for n in deepseek-endpoint speaking-prompt coach; do
  echo "== $n ==";
  grep -rnE "lib/$n|from ['\"][^'\"]*$n['\"]" src/ tests/ *.md 2>/dev/null | grep -v "lib/$n.ts:" || echo "CLEAN";
done
```
Expected: ketiganya `CLEAN`. Catatan khusus `coach`: kemunculan kata `"coach"` sebagai DATA (mis. `speaker: "coach"` di `tests/podchat-evaluate-route.spec.ts:256`) BUKAN impor modul — abaikan kemuncuan string-data; yang dihitung hanya pola path/impor di regex atas.

- [ ] **Step 2: Hapus berkas**

```bash
git rm src/app/lib/deepseek-endpoint.ts src/app/lib/speaking-prompt.ts src/app/lib/coach.ts
```

- [ ] **Step 3: Gerbang mekanis + suite evaluasi podchat (pemakai kata coach)**

Run: `npx tsc --noEmit && npx next build && npx playwright test tests/podchat-evaluate-route.spec.ts --reporter=line`
Expected: tsc/build exit 0; spec evaluate PASS (baseline-nya memang hijau).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(cleanup): remove dead libs deepseek-endpoint, speaking-prompt, coach

Zero importers across src/ and tests/ (string-data occurrences of
'coach' are unrelated). Gates: tsc, build, podchat-evaluate suite."
```

---

### Task 3: Hapus API route tanpa pemanggil `/api/word-builder/hint`

**Files:**
- Delete: `src/app/api/word-builder/hint/route.ts` (seluruh folder `hint/`)

**Interfaces:**
- Consumes: tidak ada.
- Produces: kepastian bahwa daftar endpoint Word Builder tinggal yang terpakai; dipakai Task 5 untuk laporan.

- [ ] **Step 1: Pre-delete grep gate (presisi, dua pola)**

```bash
echo "-- pola lengkap --"
grep -rn "word-builder/hint" src/ tests/ *.md ../README.md 2>/dev/null || echo "CLEAN-1"
echo "-- fetch relatif tanpa leading slash --"
grep -rnE "(fetch|axios|url)\(?.?['\"\`]api/word-builder/hint" src/ tests/ 2>/dev/null || echo "CLEAN-2"
```
Expected: `CLEAN-1` DAN `CLEAN-2`. Route ini tanpa segmen dinamis sehingga pemanggil sah pasti literal — pemindaian 2026-08-25 menemukan nol kemunculan persis `/api/word-builder/hint` di seluruh repo. Kata `hint` yang muncul di `_lib/providers.ts`/`attempt/route.ts` dsb. adalah penggunaan kata lain (kolom/fungsi), bukan path endpoint — regex di atas sudah memilahnya.

- [ ] **Step 2: Hapus**

```bash
git rm -r src/app/api/word-builder/hint
```

- [ ] **Step 3: Gerbang mekanis + suite Word Builder penuh**

Run: `npx tsc --noEmit && npx next build && npx playwright test tests/word-builder/ --reporter=line`
Expected: tsc/build exit 0; suite `tests/word-builder/` lulus pada baseline (tidak ada spec yang menyentuh endpoint hint).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(cleanup): remove unreferenced /api/word-builder/hint route

No caller in src/, tests/, or docs (exact-path and relative-fetch
greps both clean). Gates: tsc, build, full word-builder suite."
```

---

### Task 4: Perbaiki tautan rusak `/drill` di halaman practice Word Builder

**Files:**
- Modify: `src/app/word-builder/practice/page.tsx` (baris ±984-997: blok `<Link href="/drill">Go to Drill Mode →</Link>`)

**Interfaces:**
- Consumes: tidak ada.
- Produces: layar penyelesaian practice tanpa tautan menuju rute yang tidak ada (`/drill` → 404; halaman Drill Mode yang sebenarnya adalah view internal shell utama, bukan URL).

- [ ] **Step 1: Konfirmasi target benar-benar 404**

Run: `ls src/app/drill 2>/dev/null || echo "NO-PAGE"`
Expected: `NO-PAGE` (terverifikasi 2026-08-25).

- [ ] **Step 2: Hapus blok Link**

Edit `src/app/word-builder/practice/page.tsx`: buang elemen
```tsx
<Link
  href="/drill"
  className="inline-block px-8 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-sm"
>
  Go to Drill Mode →
</Link>
```
sehingga tersisa tombol "Start another session" (`window.location.reload()`). Pertahankan wrapper `<div className="flex flex-col items-center gap-3 pt-2">`.

- [ ] **Step 3: Bersihkan impor `Link` bila yatim**

Run: `grep -c "<Link" src/app/word-builder/practice/page.tsx`
Expected: `>= 1` → biarkan impor; `0` → hapus baris `import Link from "next/link";`.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit && npx next build`
Expected: exit 0. (Tidak ada spec yang menguji tautan ini; risiko regresi UI minim karena elemennya dihapus utuh.)

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(word-builder): remove dead /drill link from practice completion

Target page does not exist (404); drill mode lives inside the main
shell's view state, not a standalone URL."
```

---

### Task 5: Sapuan regresi penuh + dokumentasi

**Files:**
- Modify: tidak ada kode. (Opsional: catatan hasil di respons final ke user.)

**Interfaces:**
- Consumes: seluruh task sebelumnya sudah ter-commit.
- Produces: bukti paritas produksi sebelum/sesudah cleanup; angka akhir untuk laporan user.

- [ ] **Step 1: Reset build cache dan typecheck penuh**

Run: `rm -rf .next && npx tsc --noEmit`
Expected: exit 0, tanpa error.

- [ ] **Step 2: Build produksi**

Run: `npx next build`
Expected: sukses; daftar rute TIDAK berkurang dibanding sebelum cleanup (yang hilang hanya internal module, bukan rute — kecuali `hint` yang memang dihapus sengaja).

- [ ] **Step 3: Sapuan suite lebar**

Run: `npx playwright test tests/commonplace-ui.spec.ts tests/commonplace-schema.spec.ts tests/commonplace-maps-route.spec.ts tests/word-builder/ tests/listening-exercise/evaluation/ tests/listening-tts-provider.spec.ts tests/podchat-tts-route.spec.ts tests/podchat-evaluate-route.spec.ts tests/settings-view.spec.ts --reporter=line`
Expected: semua PASS KECUALI baseline warisan `podchat-tts-route` (31 lulus / 10 gagal-waris). Angka ini = paritas; lebih buruk dari itu = ada yang rusak, hentikan dan selidiki.

- [ ] **Step 4: Rekap untuk laporan**

Hitung: total berkas dihapus (15) + 1 blok tautan; total baris berkurang (±3.795 dari komponen+lib, plus route hint). Sertakan daftar eksklusi (cron, listening dynamic routes, dll.) sebagai bukti kehati-hatian.

- [ ] **Step 5: Laporkan ke user (Bahasa Indonesia)** — commit tidak diperlukan untuk task ini; semua perubahan sudah ter-commit di Task 1-4.
