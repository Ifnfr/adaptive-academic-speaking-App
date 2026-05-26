# MVP Test Checklist

Manual checks to run before declaring the MVP stable. Tick each box as you
verify the behavior.

## 1. Session Setup

- [ ] User can select Level (Foundation, Beginner, Intermediate, Advanced, Expert)
- [ ] User can select Mode (Fluency Sprint, Argument Drill, Reading-to-Speaking, Debate, Diagnostic)
- [ ] User can select Feedback Type (Quick, Deep)
- [ ] User can select Session Type (Micro, Standard, Deep)
- [ ] User can select AI Provider (Claude, DeepSeek, Gemini)
- [ ] User can type a Today's Target
- [ ] Start Session button is visible and labelled correctly
- [ ] After Start Session, the button becomes Restart Session
- [ ] If no history exists, the empty-state note about weakness repetition is shown

## 2. Speaking Attempt

- [ ] Active Session panel shows the chosen setup values
- [ ] Timer starts at 00:00 and counts up
- [ ] Start Timer is disabled while running
- [ ] Stop Timer pauses the count
- [ ] Reset Timer returns to 00:00
- [ ] User can type or paste a transcript
- [ ] Submit Attempt is disabled when transcript is empty or whitespace only
- [ ] Submit Attempt becomes enabled after typing real text
- [ ] After submit, the Speaking attempt panel disappears

## 3. AI Feedback

> Note: only Quick Feedback is implemented. The "Deep" Feedback Type option in
> Session setup is accepted by the UI but routes through the same Quick
> Feedback prompt; a dedicated deep-analysis mode is a future batch.

- [ ] Attempt Captured panel shows duration and transcript preview
- [ ] Get AI Feedback button is visible and enabled after capture
- [ ] While loading, button is disabled and reads "Generating feedback..."
- [ ] Successful response shows Main Weakness, Evidence, Better Phrase, Retry Task, Provider Used
- [ ] Successful response also shows a Scores section in the Quick Feedback panel
- [ ] Foundation Scores show only Fluency and Coherence
- [ ] Beginner Scores show Fluency, Grammar, and Coherence
- [ ] Intermediate / Advanced / Expert Scores show all six dimensions (Fluency, Grammar, Vocabulary, Coherence, Argument, Academic Tone)
- [ ] Each score is an integer between 1 and 5
- [ ] If the model returns a missing or out-of-range score, the UI shows 3/5 for that dimension (server-side clamp + fallback)
- [ ] Evidence references a moment from the user's transcript (not generic)
- [ ] Foundation level does NOT receive grammar or vocabulary corrections
- [ ] Foundation feedback uses simple, concrete guidance; the Better Phrase is short/repeatable and the Retry Task is doable in 30-60 seconds

## 4. Retry Loop

- [ ] Retry Attempt panel appears after feedback
- [ ] Retry task from feedback is shown above the textarea
- [ ] Submit Retry is disabled when retry transcript is empty
- [ ] After Submit Retry, Retry Captured panel appears
- [ ] Retry Captured shows the transcript preview and the message "Retry saved. You can now end the session."
- [ ] No second AI call is triggered on retry submission

## 5. End Session CSV

- [ ] End Session button is visible in Retry Captured
- [ ] Clicking End Session generates the Session Summary panel
- [ ] CSV block contains both header line and data row
- [ ] Date cell uses today's date in YYYY-MM-DD
- [ ] Foundation CSV uses 8 columns (no Grammar/Vocabulary/Argument/AcademicTone)
- [ ] Beginner CSV uses 9 columns (adds Grammar)
- [ ] Intermediate / Advanced / Expert CSV uses 12 columns
- [ ] Score columns are integers between 1 and 5, taken from the AI feedback (not a hardcoded placeholder)
- [ ] Score values in the CSV match what the Quick Feedback panel displayed
- [ ] If a score was missing or invalid in the API response, the corresponding CSV cell is `3` (safe fallback)
- [ ] Main_Weakness, Evidence, and Next_Target match the AI feedback
- [ ] Copy CSV button copies the full CSV to clipboard
- [ ] Copy confirmation appears briefly after a successful copy

## 6. localStorage History

- [ ] After End Session, a new entry is saved to localStorage key `adaptive-speaking-app:sessions`
- [ ] Refresh keeps Recent Sessions visible
- [ ] Recent Sessions shows up to 5 latest items
- [ ] Each item displays date, level, mode, Main Weakness, and Next Target
- [ ] After 6+ sessions, only the latest 5 are visible but the count "of N stored" reflects the total
- [ ] Total stored entries never exceeds 20
- [ ] Restart Session does NOT delete saved history
- [ ] Copy Last CSV button copies the latest session's CSV
- [ ] Corrupted localStorage value (invalid JSON) does not crash the page

## 7. Weakness Activation

- [ ] Previous Weakness panel appears after at least one completed session
- [ ] Previous Weakness shows Main Weakness and Next Target from the latest session
- [ ] If Today's Target is empty, Start Session uses the previous retry task as the active target
- [ ] Active Session shows "Today we target: [previous retry task]" when auto-filled
- [ ] If Today's Target is filled manually, the user's text is preserved (not overwritten)

## 8. Error Handling

- [ ] Missing API key for selected provider shows a clear, short error
- [ ] Wrong Gemini model shows: "Gemini model not available. Check GEMINI_MODEL in .env.local."
- [ ] Network failure shows a short error, not a stack trace
- [ ] Empty transcript cannot be submitted
- [ ] Empty retry transcript cannot be submitted
- [ ] Long upstream error messages are truncated in the UI

## 9. Security Checks

- [ ] `.env.local` is not tracked by Git (`git status` does not list it)
- [ ] API keys do not appear in browser request bodies (DevTools → Network → request payload)
- [ ] API keys do not appear in the JS bundle (DevTools → Sources → search for partial key)
- [ ] No `NEXT_PUBLIC_` prefixed provider keys exist
- [ ] Provider HTTP errors do not leak full upstream JSON to the UI
- [ ] No real keys committed in `.env.example`, README, or any docs file

## 10. Coach Recommendation

> Note: this is a deterministic, local rule-based scaffold. It reads only
> what is already in localStorage history. It does not call any AI model.

- [ ] Coach Recommendation panel appears between Previous Weakness and Active Session
- [ ] Panel hides automatically once a session is active (after Start Session)
- [ ] With no history, panel shows: focus "Build speaking volume", Mode "Fluency Sprint", Session Type "Micro", and a message that one session is needed to personalize
- [ ] With at least one stored session, focus uses the latest retryTask (or mainWeakness if retryTask is missing)
- [ ] Recommended Session Type is Micro for Foundation/Beginner, Standard for Intermediate, Deep for Advanced/Expert
- [ ] Recommended Mode reflects the latest weakness/retryTask keywords (Fluency Sprint for fluency/pause/hesitation; Argument Drill for argument/evidence/coherence; vocabulary/academic-tone keywords map to Argument Drill)
- [ ] Reason text references the date of the last session and names the recommended Mode
- [ ] Use Recommendation button updates Mode, Session Type, and Today's Target in Session setup
- [ ] User can still manually override Level, Mode, Session Type, and Today's Target after using the recommendation
- [ ] Recommendation never auto-applies without the user clicking Use Recommendation

## 11. Diagnostic Mode

> Note: Diagnostic Mode is a standalone assessment. It uses a separate API
> route (`/api/diagnostic`) and does not produce Quick Feedback, Retry, CSV,
> or history entries.

- [ ] Diagnostic appears as an option in the Mode selector
- [ ] When Mode is Diagnostic, the Speaking Prompt panel shows three sections (A, B, C) instead of the normal mode prompt
- [ ] Diagnostic prompt does NOT include any sample answers
- [ ] After submitting the transcript, the Captured panel shows "Run Diagnostic" instead of "Get AI Feedback"
- [ ] Run Diagnostic button is disabled and reads "Running diagnostic..." while loading
- [ ] On success, a Diagnostic Result panel appears with Recommended Level, Main Bottleneck, Summary, six 1-5 Scores, and a 7-Day Focus Plan
- [ ] Diagnostic 7-Day Focus Plan is calibrated to the Recommended Level
- [ ] Foundation Diagnostic plans use simple 10-20 minute speaking drills and do not recommend journal abstracts, academic papers, or advanced research tasks
- [ ] Each score is an integer between 1 and 5
- [ ] Recommended Level is one of: Foundation, Beginner, Intermediate, Advanced, Expert
- [ ] If the model returns an unknown level, the result falls back to "Foundation"
- [ ] If the model returns missing or invalid scores, each missing dimension falls back to 3
- [ ] Apply Recommended Level button updates the Level selector and Today's Target in Session setup
- [ ] Diagnostic Mode does NOT show Quick Feedback, Retry attempt, Retry captured, or Session summary panels
- [ ] Diagnostic Mode does NOT add a new entry to localStorage `adaptive-speaking-app:sessions`
- [ ] Recent Sessions and Previous Weakness panels are unaffected by running a diagnostic
- [ ] Provider errors (rate limit, key rejected, model unavailable) show short friendly messages, never raw JSON

## 12. Level-Up Check

> Note: Level-Up Check is a deterministic, local rule-based feature. It reads
> only existing session CSV strings from localStorage and does not call AI.

- [ ] Level-Up Check appears in the Analytics sidebar and opens the Progress view
- [ ] Progress shows Current Level, Next Level, Status, Evidence, Missing requirements, and Recommended next action
- [ ] Malformed or incomplete session CSV entries are ignored without crashing
- [ ] Almost ready appears only when enough valid sessions exist and averages are close to the thresholds
- [ ] Expert shows Max level reached and no Apply Next Level button
- [ ] Apply Next Level appears only when status is Ready and updates only Level, Today's Target, and view
- [ ] Applying the next level does NOT change localStorage history or CSV data

## 13. Weekly Review Agent

> Note: Weekly Review is an AI feature. It sends only compact recent session
> summaries to `/api/weekly-review` and does not store review results.

- [ ] Weekly Review opens from the sidebar without starting automatically
- [ ] With fewer than 4 sessions, the view shows "Weekly Review requires at least 4 completed practice sessions."
- [ ] With 4+ sessions, Run Weekly Review is enabled and shows a loading state while running
- [ ] The request sends only the latest 4 to 7 session summaries, not full transcripts or retry transcripts
- [ ] Successful review shows Summary, Recurring Weakness, Best Improvement, Score Trend, Next Week Focus, and a 7-Day Recommended Plan
- [ ] The 7-Day Recommended Plan is appropriate for the latest submitted session level
- [ ] Foundation Weekly Review plans use simple 10-20 minute speaking drills and do not recommend journal abstracts, academic papers, or advanced research tasks
- [ ] Weekly Review accepts valid provider JSON when wrapped in markdown code fences or small surrounding text
- [ ] Warnings appear only when the response includes non-empty warnings
- [ ] Provider errors and malformed JSON responses show friendly retryable errors without raw upstream JSON
- [ ] Running Weekly Review does NOT change localStorage history, CSV data, feedback, diagnostic, retry, or speech input behavior

## 14. Mental Model Session

> Note: Mental Model is an AI teaching feature. It sends setup context plus
> latest weakness/retry text only, and it does not store results.

- [ ] Mental Model opens from the sidebar and does not auto-run
- [ ] The view shows current Level, current Mode, and an editable Focus / Weakness field
- [ ] Blank focus falls back to current target, latest retry task, latest weakness, or a generic academic response focus
- [ ] Generate Mental Model sends provider, level, mode, focus, latestWeakness, and latestRetryTask only
- [ ] Successful result shows Core Standard, Quality Criteria, Weak Pattern, Strong Pattern, Self-Check Questions, Micro Drill, and Reference Model
- [ ] The route rejects malformed JSON, invalid criteria/question counts, or an overly long reference model with a friendly error
- [ ] Mental Model accepts valid JSON returned inside markdown code fences or short surrounding provider text
- [ ] Foundation Mental Model output uses simple speaking standards and avoids abstract theory, counterarguments, advanced vocabulary lists, and essay-like structure
- [ ] The UI does not provide a copy/use-as-answer action for the reference model
- [ ] Running Mental Model does NOT change localStorage history, CSV data, feedback, diagnostic, weekly review, retry, or speech input behavior
