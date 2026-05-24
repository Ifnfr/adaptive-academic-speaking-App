# MVP Test Checklist

Manual checks to run before declaring the MVP stable. Tick each box as you
verify the behavior.

## 1. Session Setup

- [ ] User can select Level (Foundation, Beginner, Intermediate, Advanced, Expert)
- [ ] User can select Mode (Fluency Sprint, Argument Drill, Reading-to-Speaking, Debate)
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
