# fonetik MVP Test Checklist

Manual checks to run before declaring the local MVP stable.

## 1. App Shell and Navigation

- [ ] Sidebar renders the fonetik logo, Speak Better tagline, Current Level card, nav groups, and Day Streak card
- [ ] Topbar title, subtitle, active/idle chip, mode chip, and level chip update correctly
- [ ] Active Session opens from the sidebar
- [ ] Session Log opens from the sidebar
- [ ] Progress opens from the sidebar
- [ ] Level-Up Check opens the Progress view
- [ ] Weekly Review opens from the sidebar
- [ ] Diagnostic shortcut selects Diagnostic mode and opens Active Session
- [ ] Mental Model opens from the sidebar
- [ ] Settings placeholder opens from the sidebar
- [ ] Article Practice is not shown as an implemented feature

## 2. Session Setup

- [ ] User can select Level: Foundation, Beginner, Intermediate, Advanced, Expert
- [ ] User can select Mode: Fluency Sprint, Argument Drill, Reading-to-Speaking, Debate, Diagnostic
- [ ] Diagnostic mode card is visible and clearly marked as assessment
- [ ] User can select Feedback Type: Quick, Deep
- [ ] User can select Session Type: Micro, Standard, Deep
- [ ] User can select AI Provider: Claude, DeepSeek, Gemini
- [ ] User can type a Today's Target
- [ ] Start Session button is visible
- [ ] After Start Session, the button becomes Restart Session
- [ ] Current setup values remain controlled when navigating away and back

## 3. Prompt Generation

- [ ] Normal modes render a local Speaking Prompt after Start Session
- [ ] Speaking Prompt shows task, constraints, target structure, and time limit
- [ ] Diagnostic mode renders the A/B/C diagnostic prompt
- [ ] Diagnostic prompt does not include sample answers
- [ ] Regenerate Local Prompt works
- [ ] Regenerate Local Prompt does not clear the transcript
- [ ] Regenerate Local Prompt does not reset the timer
- [ ] Local prompt generation does not call an AI API

## 4. Speaking Attempt and Speech Input

- [ ] Active Session panel shows the chosen setup values
- [ ] Timer starts at 00:00 and counts up
- [ ] Start Timer is disabled while running
- [ ] Stop Timer pauses the count
- [ ] Reset Timer returns to 00:00
- [ ] User can type or paste a transcript
- [ ] Speech input controls appear when the browser supports speech recognition
- [ ] Start Speech Input begins listening and appends recognized text to the transcript
- [ ] Stop Speech Input stops listening
- [ ] Unsupported browsers show a safe fallback and manual transcript input still works
- [ ] Speech errors show a short friendly message
- [ ] Submit Attempt is disabled when transcript is empty or whitespace only
- [ ] Submit Attempt becomes enabled after typing real text
- [ ] Captured Attempt shows duration, word count, and transcript preview

## 5. AI Feedback

> Quick Feedback is implemented. The Deep Feedback setup option currently uses
> the same Quick Feedback route; dedicated Deep Feedback is future work.

- [ ] Get AI Feedback button appears after capturing a normal attempt
- [ ] While loading, button is disabled and reads "Generating feedback..."
- [ ] Successful response shows Main Weakness, Evidence, Better Phrase, Retry Task, Provider Used, and Scores
- [ ] Foundation Scores show only Fluency and Coherence
- [ ] Beginner Scores show Fluency, Grammar, and Coherence
- [ ] Intermediate, Advanced, and Expert Scores show all six dimensions
- [ ] Each score is an integer between 1 and 5
- [ ] Missing or invalid scores fall back safely to 3 for that dimension
- [ ] Evidence references a real moment from the transcript
- [ ] Foundation feedback does not correct grammar or vocabulary directly
- [ ] Foundation Better Phrase is short, simple, and repeatable
- [ ] Foundation Retry Task is doable in 30-60 seconds

## 6. Retry Loop

- [ ] Retry Attempt panel appears after feedback
- [ ] Retry task from feedback is shown above the textarea
- [ ] Submit Retry is disabled when retry transcript is empty
- [ ] After Submit Retry, Retry Captured panel appears
- [ ] Retry Captured shows transcript preview and "Retry saved" copy
- [ ] No second AI call is triggered on retry submission

## 7. End Session CSV

- [ ] End Session button appears in Retry Captured
- [ ] Clicking End Session generates the Session Summary panel
- [ ] CSV block contains header line and data row
- [ ] Date cell uses YYYY-MM-DD
- [ ] Foundation CSV uses no Grammar, Vocabulary, Argument, or AcademicTone score columns
- [ ] Beginner CSV adds Grammar
- [ ] Intermediate, Advanced, and Expert CSV include all six score columns
- [ ] Score columns match the Quick Feedback panel
- [ ] Missing or invalid API score values become `3` in CSV
- [ ] Main_Weakness, Evidence, and Next_Target match AI feedback
- [ ] Copy CSV copies the full CSV
- [ ] Copy confirmation appears briefly

## 8. localStorage History and Session Log

- [ ] Normal End Session saves a new entry to `adaptive-speaking-app:sessions`
- [ ] Refresh keeps Recent Sessions visible
- [ ] Session Log shows up to 5 latest items in newest-first order
- [ ] Session Log count reflects total stored sessions
- [ ] Total stored entries never exceeds 20
- [ ] Each item displays date, level, mode, Main Weakness, and Next Target
- [ ] Copy Last CSV copies the newest session CSV
- [ ] Restart Session does not delete saved history
- [ ] Corrupted localStorage JSON does not crash the page

## 9. Progress, Day Streak, and Level-Up Check

- [ ] Progress view renders total sessions, current streak, latest level, and recent activity
- [ ] Day Streak card renders in the sidebar
- [ ] Day Streak is 0 when there are no completed sessions
- [ ] Day Streak is derived from local session dates without new storage
- [ ] Level-Up Check shows Current Level, Next Level, Status, Evidence, Missing requirements, and Recommended next action
- [ ] Malformed or incomplete session CSV entries are ignored safely
- [ ] Almost ready appears only when enough valid sessions exist and averages are close
- [ ] Expert shows Max level reached and no Apply Next Level button
- [ ] Apply Next Level appears only when status is Ready and updates only Level, Today's Target, and view
- [ ] Apply Next Level does not modify localStorage history or CSV data

## 10. Coach Recommendation and Previous Weakness

> Coach Recommendation is deterministic and local. It reads existing session
> history and does not call an AI model.

- [ ] Coach Recommendation appears before a session is active
- [ ] Coach Recommendation hides once a session is active
- [ ] With no history, recommendation suggests a beginner-friendly starting point
- [ ] With history, focus uses latest retryTask or mainWeakness
- [ ] Use Recommendation updates Mode, Session Type, and Today's Target
- [ ] Recommendation never auto-applies
- [ ] Previous Weakness appears after at least one completed session
- [ ] Previous Weakness shows Main Weakness and Next Target from the latest session
- [ ] Empty Today's Target auto-fills from previous retry task when starting a session
- [ ] Manually filled Today's Target is preserved

## 11. Diagnostic Mode

> Diagnostic Mode is a standalone assessment through `/api/diagnostic`. It does
> not produce Retry, CSV, or history entries.

- [ ] Diagnostic appears as a Mode option
- [ ] Diagnostic prompt shows three sections: A, B, C
- [ ] Captured panel shows Run Diagnostic instead of Get AI Feedback
- [ ] Run Diagnostic loading state works
- [ ] Diagnostic Result shows Recommended Level, Main Bottleneck, Summary, Scores, and 7-Day Focus Plan
- [ ] Recommended Level is Foundation, Beginner, Intermediate, Advanced, or Expert
- [ ] Missing or invalid diagnostic scores fall back to 3
- [ ] Apply Recommended Level updates Level and Today's Target
- [ ] Diagnostic does not show Retry, CSV, or Session Summary panels
- [ ] Diagnostic does not add a localStorage history entry
- [ ] Foundation diagnostic plan uses simple 10-20 minute speaking drills
- [ ] Foundation diagnostic plan does not recommend journal abstracts, academic papers, or advanced research tasks

## 12. Weekly Review Agent

> Weekly Review sends compact recent session summaries to `/api/weekly-review`.
> It does not store review results.

- [ ] Weekly Review opens without auto-running
- [ ] With fewer than 4 sessions, the requirement message appears
- [ ] With 4+ sessions, Run Weekly Review is enabled
- [ ] Request sends latest 4 to 7 session summaries, not full transcripts or retry transcripts
- [ ] Successful review shows Summary, Recurring Weakness, Best Improvement, Score Trend, Next Week Focus, and 7-Day Recommended Plan
- [ ] Warnings appear only when non-empty warnings are returned
- [ ] Foundation Weekly Review plan is simple, practical, and speaking-drill based
- [ ] Weekly Review accepts valid JSON inside markdown fences or short surrounding provider text
- [ ] Weekly Review provider errors are friendly and do not expose raw upstream JSON
- [ ] Running Weekly Review does not change localStorage history, CSV data, feedback, diagnostic, retry, or speech input behavior

## 13. Mental Model Session

> Mental Model sends setup context plus latest weakness/retry text to
> `/api/mental-model`. It does not store results.

- [ ] Mental Model opens without auto-running
- [ ] View shows current Level, current Mode, and editable Focus / Weakness
- [ ] Blank focus falls back to current target, latest retry task, latest weakness, or generic academic response focus
- [ ] Request sends provider, level, mode, focus, latestWeakness, and latestRetryTask only
- [ ] Successful result shows Core Standard, Quality Criteria, Weak Pattern, Strong Pattern, Self-Check Questions, Micro Drill, and Reference Model
- [ ] Invalid criteria/question counts or overly long reference model are rejected with friendly errors
- [ ] Mental Model accepts valid JSON inside markdown fences or short surrounding provider text
- [ ] Foundation Mental Model uses simple speaking standards and avoids abstract theory, counterarguments, advanced vocabulary lists, and essay-like structure
- [ ] UI does not provide a copy/use-as-answer action for the reference model
- [ ] Running Mental Model does not change localStorage history, CSV data, feedback, diagnostic, weekly review, retry, or speech input behavior

## 14. Provider Errors and Security

- [ ] Missing API key shows a clear short error
- [ ] Rejected API key shows a friendly message, not raw provider JSON
- [ ] Rate limit shows a friendly retry/wait message
- [ ] Model unavailable shows a provider-specific friendly message
- [ ] Network failure shows a short error, not a stack trace
- [ ] `.env.local` is not tracked by Git
- [ ] No real API keys appear in docs, `.env.example`, request bodies, or JS bundles
- [ ] No provider key uses `NEXT_PUBLIC_`
- [ ] Provider calls happen only through server-side API routes
- [ ] No database, auth, or cloud sync is implied by UI or docs

## 15. Foundation Calibration

- [ ] Foundation Feedback avoids advanced vocabulary upgrades, counterarguments, complex evidence tasks, and long polished rewrites
- [ ] Foundation Diagnostic plans are concrete speaking drills
- [ ] Foundation Weekly Review plans are practical 10-20 minute speaking drills
- [ ] Foundation Mental Model teaches simple pattern recognition, not essay-like standards
- [ ] Foundation outputs do not recommend journal abstracts, academic papers, or advanced research tasks

## 16. Performance and UX

- [ ] Page scroll remains lightweight on desktop and mobile widths
- [ ] UI text remains readable over the light grid/card texture
- [ ] No chart library, canvas, heavy animation, or blur/backdrop-filter is required
- [ ] No polling or background intervals run beyond timer/copy-status behavior
- [ ] Cards and buttons remain usable at mobile widths

## 17. Gamification Foundation

> Gamification helpers are deterministic and local. The first UI layer is
> visible, but XP awards are not connected to session actions until the next
> implementation phase.

- [ ] XP helpers do not modify existing session history or CSV data
- [ ] Malformed gamification localStorage values normalize safely
- [ ] XP amounts come only from `XP_RULES`, never from AI output
- [ ] Claim XP is blocked after one claim per local day
- [ ] Sidebar shows Speaker Level separately from English Level
- [ ] Progress view shows total XP, pending XP, previous unclaimed XP, and claim state
- [ ] No fake/test XP buttons are present
- [ ] Completing a normal session awards deterministic pending XP once per session
- [ ] Completing a valid retry, diagnostic, weekly review, mental model, or level-up awards deterministic pending XP with daily caps
- [ ] Diagnostic sessions do not create normal session history XP
- [ ] Article Practice and Vocabulary XP event types remain reserved and are not wired yet
- [ ] First-action badges and Speaker Level 5 badge are visual only and do not award XP

## 18. Vocabulary Notebook

> Vocabulary Notebook is local, deterministic, and not connected to AI or XP yet.

- [ ] Vocabulary helpers use only `adaptive-speaking-app:vocabulary`
- [ ] Malformed vocabulary localStorage values normalize safely
- [ ] Sidebar opens Vocabulary Notebook from the Practice section
- [ ] Add Vocabulary form saves word, meaning, level, source, optional example, and collocations
- [ ] Saved vocabulary list shows status, level, source, reuse count, Practice, and Delete controls
- [ ] Empty vocabulary practice sentences are rejected
- [ ] Sentences without the target word or phrase are rejected
- [ ] Accepted sentences increment reuse count and move `new` items to `practicing`
- [ ] Recent saved sentences appear for the selected vocabulary item
- [ ] Accepted vocabulary sentences award deterministic `vocab_sentence_submitted` pending XP
- [ ] Rejected vocabulary sentences do not award XP
- [ ] Saved vocabulary sentences can be checked with AI correction after the user writes them
- [ ] Correction results save locally on the sentence without replacing the original user sentence
- [ ] Natural or understandable correction increments `correctUseCount` once per sentence
- [ ] Checking/correcting vocabulary usage does not award XP
- [ ] `vocab_reused` remains reserved and is not wired yet
- [ ] Vocabulary Notebook does not modify session history or CSV data

## 19. Vocabulary Correction API

> Vocabulary Correction checks one learner-written sentence and saves short feedback locally in Vocabulary Notebook.

- [ ] `/api/vocabulary-correction` rejects invalid provider, level, empty word, and empty sentence
- [ ] Sentence must include the target vocabulary word or phrase before provider call
- [ ] Provider keys stay server-side and missing keys return friendly errors
- [ ] Route accepts raw, fenced, or surrounded JSON provider output
- [ ] Corrected sentence is one short sentence, not a paragraph or multiple alternatives
- [ ] Foundation correction uses simple wording and one main correction
- [ ] UI does not auto-replace the user's original sentence or provide a copy-as-answer flow
- [ ] Route does not modify XP, session history, CSV data, or Article Practice behavior

## 20. Article Practice API

> Article Practice turns a user-provided article URL into copyright-safe speaking practice. UI integration is future work.

- [ ] `/api/article-practice` accepts only HTTP/HTTPS article URLs
- [ ] Obvious local/private hosts are rejected before server-side fetch
- [ ] Non-HTML, oversized, blocked, dynamic, or paywalled pages return friendly errors
- [ ] Full article text is never returned to the client or stored
- [ ] Result contains article snapshot, brief, main idea, key points, vocabulary, checks, speaking task, follow-up questions, and warnings
- [ ] Foundation speaking tasks stay simple, 30-60 seconds, and avoid research/counterargument/evidence-evaluation tasks
- [ ] Provider JSON parsing handles raw, fenced, or surrounded JSON while keeping schema validation strict
- [ ] Article Practice does not add localStorage history, XP, vocabulary saving, speaking attempts, or Article Practice UI yet
