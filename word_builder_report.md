# Word Builder Backend Feature Implementation Report

This report documents the design, database schema, API logic, and verification results for the new **Word Builder** sentence production practice feature.

---

## 1. Database Schema & Migration

A Supabase SQL migration script has been created at:
[20260624_001_word_builder_schema.sql](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/supabase/migrations/20260624_001_word_builder_schema.sql)

### Tables Implemented

#### `word_builder_prompts`
Stores the prompts presented to users for sentence building.
- `id`: `uuid` (Primary Key, defaults to `gen_random_uuid()`)
- `prompt_text`: `text` (Not null)
- `topic_domain`: `text` (Not null, constrained to `economics`, `technology`, `daily_habits`, or `opinion`)
- `mode`: `text` (Not null, default `'guided'`, constrained to `guided`, `semi_free`, or `transfer`)
- `implied_structures`: `jsonb` (Not null, default `'[]'`)
- `created_at`: `timestamptz` (Not null, default `now()`)

#### `word_builder_sessions`
Tracks the sessions started by learners.
- `id`: `uuid` (Primary Key, defaults to `gen_random_uuid()`)
- `user_id`: `uuid` (Not null, references `auth.users(id)` on delete cascade)
- `started_at`: `timestamptz` (Not null, default `now()`)
- `completed_at`: `timestamptz`
- `prompts_attempted`: `integer` (Not null, default `0`)
- `prompts_correct_first_try`: `integer` (Not null, default `0`)

#### `word_builder_attempts`
Records each individual sentence production attempt.
- `id`: `uuid` (Primary Key, defaults to `gen_random_uuid()`)
- `session_id`: `uuid` (Not null, references `word_builder_sessions(id)` on delete cascade)
- `prompt_id`: `uuid` (Not null, references `word_builder_prompts(id)`)
- `prompt_mode`: `text` (Not null)
- `attempt_text`: `text` (Not null)
- `is_correct`: `boolean` (Not null, default `false`)
- `attempt_number`: `integer` (Not null, default `1`)
- `hints_used`: `integer` (Not null, default `0`)
- `is_echo_attempt`: `boolean` (Not null, default `false`)
- `created_at`: `timestamptz` (Not null, default `now()`)

#### `word_builder_errors`
Tracks structured grammatical errors detected by the evaluation engine.
- `id`: `uuid` (Primary Key, defaults to `gen_random_uuid()`)
- `attempt_id`: `uuid` (Not null, references `word_builder_attempts(id)` on delete cascade)
- `category`: `text` (Not null, constrained to `auxiliary_verb`, `subject_verb_agreement`, `tense`, `article`, `preposition`, `word_order`, or `verb_form`)
- `severity`: `text` (Not null, constrained to `critical` or `minor`)
- `resolved`: `boolean` (Not null, default `false`)
- `hints_used_for_error`: `integer` (Not null, default `0`)

### Row-Level Security (RLS) Policies
Row-level security has been enabled on all four tables:
- `word_builder_prompts`: Allowed `SELECT` queries for all authenticated users.
- `word_builder_sessions`: Allowed `SELECT`, `INSERT`, and `UPDATE` queries where `auth.uid() = user_id`.
- `word_builder_attempts`: Allowed `SELECT` and `INSERT` queries for sessions owned by `auth.uid()` (verified by a join to `word_builder_sessions`).
- `word_builder_errors`: Allowed `SELECT` and `INSERT` queries for attempts owned by `auth.uid()` (verified by a join through `word_builder_attempts` to `word_builder_sessions`).

### Seed Data
The `word_builder_prompts` table is seeded with the exactly requested 15 prompts.

---

## 2. Evaluation API Route

The evaluation API handler is implemented at:
[route.ts](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/api/word-builder/evaluate/route.ts)

### Endpoint Details
- **Path**: `/api/word-builder/evaluate`
- **Method**: `POST`
- **Authentication**: Clerk JWT-based authentication. Unauthenticated requests are rejected with a `401 Unauthorized` status.
- **Request Body**:
  ```json
  {
    "sentence": "user's sentence",
    "promptId": "uuid-of-prompt",
    "promptText": "text-of-prompt"
  }
  ```

### AI Logic & DeepSeek Integration
The route connects to DeepSeek Chat (`deepseek-chat`) with:
- **API Key**: `process.env.DEEPSEEK_API_KEY`
- **Base URL**: `https://api.deepseek.com/chat/completions`
- **Temperature**: `0` (for high consistency and reliability)
- **Max Tokens**: `1000`

### System Prompt
```typescript
You are a grammar evaluation engine for an English language learning app. Your job is to evaluate English sentences written by Indonesian learners and return structured error data.

CRITICAL RULES:
1. Return ONLY valid JSON. No preamble, no explanation, no markdown formatting, no backticks.
2. Evaluate all of these dimensions simultaneously: subject-verb agreement, auxiliary verb presence and correctness, tense consistency, article usage, preposition correctness, word order, verb form.
3. For locationHint: be vague about location only. Never name the grammatical rule. Never reveal the correction. Example of GOOD locationHint: "There is an issue with the verb used after the modal in your sentence." Example of BAD locationHint: "You need to use a bare infinitive after 'will'."
4. For ruleReference: state the rule clearly and explicitly, but do not show the correction applied to the learner's sentence.
5. For guidedCompletion: reproduce the learner's sentence with the ONE most critical error replaced by a blank (___). Do not blank out multiple words.
6. For echoPrompt: generate a new prompt on a different topic that would naturally require the same grammar structures as the errors found. If no errors, generate a prompt on a related topic.
7. If the sentence is correct, return isCorrect: true, errors: [], correctedSentence as the original sentence, and a new echoPrompt anyway.
8. correctedSentence must be the fully corrected version of the learner's input — not a model answer, but the learner's own sentence with all errors fixed.

RESPONSE FORMAT:
{"isCorrect":boolean,"errors":[{"errorId":"err_1","category":"auxiliary_verb|subject_verb_agreement|tense|article|preposition|word_order|verb_form","severity":"critical|minor","locationHint":"string","ruleReference":"string","guidedCompletion":"string","resolved":false}],"correctedSentence":"string","echoPrompt":"string"}
```

---

## 3. Verification & Validation Results

1. **Git Isolation**: Checked `git status` to confirm that only the required migration file and the updated API route file were created/modified.
2. **Type Checking**: Ran `npx tsc --noEmit` on the codebase. Zero compile or type-checking errors were found, confirming standard TypeScript compliance.
