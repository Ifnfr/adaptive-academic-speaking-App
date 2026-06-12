# fonetik Project Context

Last updated: 2026-06-12

This document is the current handoff source of truth for AI agents working on
the fonetik repository.

## Product Identity

- Product/UI name: **fonetik**
- Tagline: **Speak Better**
- Current active workstream: **Commonplace**
- Production app: https://adaptive-academic-speaking-app.vercel.app/
- Primary app package: `app-web`
- GitHub repository: `Ifnfr/adaptive-academic-speaking-App`
- Default branch: `main`
- Latest relevant commit at this update: `90b8185 Add Commonplace server-persisted theme settings`

fonetik is a local-first academic speaking practice app. It combines practice
sessions, vocabulary work, article-based speaking tasks, profile/settings,
cloud-backed signed-in persistence, and a Commonplace system for saving ideas
and arranging them visually in maps.

## Current Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Clerk authentication
- Supabase Postgres with RLS
- React Flow for Commonplace map canvases
- Playwright for targeted UI and route validation
- Vercel production deployment
- Browser `localStorage` for the older local-first practice features

## Current MVP Scope

- Dashboard shell with sidebar navigation and topbar status.
- Active Session and Session Setup with mode cards, level selection, provider
  choice, browser speech-to-text, manual transcript input, prompt generation,
  AI feedback, retry practice, CSV summaries, and local session log.
- Vocabulary Notebook 2.0 with recent preview, dictionary mode, sentence
  history, delete/status actions, active recall practice, and AI vocabulary
  correction through `/api/vocabulary-correction`.
- Gamification with local XP events, pending XP, Speaker Levels, daily claims,
  badges, and duplicate-protected reward rules.
- Article Practice with URL fetch, copyright-safe task generation, vocabulary
  save, and Article Practice -> Active Session bridge.
- Profile and Settings split into owner-only views. Settings handles editable
  profile fields, language preferences, public profile toggle, leaderboard
  opt-in, provider preferences, and Commonplace appearance preferences.
- UI and AI feedback localization. App language can render English/Indonesian
  UI labels for wired views. Feedback language controls AI explanation
  language. Target practice language remains English only.
- User-only leaderboard using sanitized public fields only.
- Learning Path Phase 1 and Phase 2 as static, local-first curriculum.
- Feedback Normalization, Adaptive Tutor Memory, Human-Approved Improvement
  Loop, and Developer Diagnostics foundations as pure helper libraries with
  strict privacy boundaries and no UI/storage/model side effects.
- Commonplace Library, note CRUD, map registry, React Flow canvases, Inventory,
  Sub Mind Maps, Main Maps, mixed visual nodes, mixed visual edges, drag-back
  visual node removal, and server-persisted Commonplace theme settings.

## Commonplace Terminology

- **Library note**: the source note record stored in Commonplace. It contains
  source book, title, insight, tags, connections, shortcode, and related note
  metadata.
- **Visual node**: a canvas instance. It is not the Library note itself.
- One Library note can appear multiple times on the same map as independent
  visual node instances with different node IDs and positions.
- **Sub Mind Map**: an idea-level note map. It contains visual note nodes and
  edges between those visual node IDs.
- **Main Map**: a higher-level visual map. It can contain cluster nodes and
  note nodes.
- **Cluster node**: a Main Map visual reference to a Sub Mind Map.
- **Edge**: a connection between visual node IDs, not raw note IDs.
- **Inventory**: the saved map navigation panel inside map canvases. Use this
  term. Do not call the current UI "Laci" or "Drawer".

## Commonplace Current Capabilities

### Library and Notes

- Commonplace runs as a dedicated mode with the standard Fonetik sidebar hidden
  and a Commonplace sidebar visible.
- Library grid is the default Commonplace view.
- `+ Baru` and the Add Note tile open the in-place create form.
- Source book, title, and insight are required fields in the UI.
- Note cards and sidebar notes open the existing detail view.
- Create, read, edit, and delete note flows use server routes.
- `POST /api/commonplace/notes` remains the production note-creation path.
- Library notes are preserved when their visual nodes are removed from maps.

### Sub Mind Maps

- Sub Mind Maps use React Flow.
- Notes can be dragged from the sidebar into a Sub Mind Map canvas.
- The same Library note can be dragged into the same Sub Map more than once.
- Duplicate visual nodes have different node IDs and independent positions.
- Node movement marks unsaved changes. Manual Save persists positions.
- Connect Idea supports solid and dashed edges with optional labels.
- Self-edges are rejected.
- Edge source and target use visual node IDs.
- Edge edit, edge type change, label update, delete, save, reload persistence,
  and node preservation after edge delete are implemented.
- Canvas note nodes can be dragged back to the Library/sidebar area. Drag-back
  removes only the visual node from the canvas and preserves the source Library
  note.
- Sub Map visual node DELETE is enabled.
- Connected visible edges are removed locally when a visual node is removed.

### Main Maps

- Main Map registry allows multiple Main Maps. Do not collapse it to one map.
- Main Map supports cluster visual nodes that reference saved Sub Mind Maps.
- Main Map supports individual note visual nodes.
- Sidebar notes can be dragged into Main Map canvas.
- Duplicate Main Map note nodes are allowed.
- Main Map note nodes can be moved, saved, and reloaded.
- Main Map visual note deletion preserves Library notes.
- Main Map cluster deletion preserves referenced Sub Mind Maps.
- Main Map supports mixed visual-node edges:
  - cluster -> cluster
  - cluster -> note
  - note -> cluster
  - note -> note
- Main Map edge labels and solid/dashed edge types are preserved.
- Self-edges are rejected.
- Foreign/cross-map nodes are rejected.
- Cluster and note visual affordances, toolbar copy, and empty-state copy have
  been hardened.

### Inventory

- Inventory is the saved-map panel inside the map canvas.
- It appears only in map views.
- It lists Main Maps and Sub Mind Maps separately.
- Opening saved Main/Sub Maps from Inventory works.
- Active map marker is present.
- Main -> Main, Main -> Sub, Sub -> Sub, and Sub -> Main switching works.
- Unsaved-change confirmation uses real dirty state, including failed-save
  dirty state.
- No visible "Laci" or "Drawer" copy should remain in current UI.

### Save State and Runtime Behavior

- Manual save state supports unsaved, saving, saved, and save-failed states.
- Autosave has not been introduced.
- Canvas workspace was expanded in Phase 10C:
  - Old: `h-[min(68dvh,720px)] min-h-[460px]`
  - New: `h-[min(78dvh,860px)] min-h-[420px] sm:min-h-[520px] lg:min-h-[560px]`
- Header vertical pressure was reduced.
- React Flow controls remain clickable.
- Inventory does not block controls.

### Commonplace Theme Settings

- Phase 10D added Commonplace-only server-persisted theme settings.
- Commit: `90b8185 Add Commonplace server-persisted theme settings`
- Remote Supabase migration was applied and verified.
- New `profiles` columns:
  - `commonplace_canvas_color`
  - `commonplace_card_color`
- Both columns are `text not null default 'default'`.
- Allowed color IDs:
  - `default`
  - `paper`
  - `sage`
  - `sand`
  - `sky`
  - `lavender`
  - `rose`
  - `slate`
  - `charcoal`
- Settings has a Commonplace appearance section.
- Canvas color and card color are independent.
- There are no fixed theme bundles.
- There is no arbitrary custom hex input.
- The source of truth is server persistence, not `localStorage`.
- Theme applies only to Commonplace.
- Main/Sub map canvas uses the selected canvas color.
- Commonplace sidebar and Library note cards use the selected card color.
- Visual note node tag/identity colors are preserved.
- Global fonetik theme is unchanged.
- Authenticated production smoke passed after the remote migration.
- Final smoke-test preference state was restored to Default/Default.

## Commonplace Phase History

### Phase 8E

- Main Map individual note visual nodes implemented.
- Sidebar notes can be dragged into Main Map canvas.
- Duplicate Main Map note nodes are allowed.
- Main Map note nodes can be moved, saved, and reloaded.
- Original Library notes are preserved.

### Phase 8F

- Main Map mixed node UX hardened.
- Cluster vs note visual affordances clarified.
- Main Map toolbar and copy clarified.
- Main Map empty state clarified.

### Phase 8G

- Safe Main Map visual node deletion implemented.
- Deleting visual note nodes preserves Library notes.
- Deleting visual cluster nodes preserves referenced Sub Mind Maps.

### Phase 8H

- Manual save-state UX hardened.
- Unsaved/saving/saved/save-failed states work.
- Autosave was not introduced.

### Phase 8I

- Main Map mixed edge capability audit completed.
- Schema can support mixed visual-node edges.

### Phase 8J

- Main Map mixed visual-node edges implemented.
- Supported directions: cluster -> cluster, cluster -> note, note -> cluster,
  note -> note.
- Edge labels and solid/dashed edge types are preserved.
- Self-edges are rejected.
- Foreign/cross-map nodes are rejected.
- Sub Mind Map still uses Connect Idea.

### Phase 8K

- Main/Sub Map regression audit passed.
- No blocking regressions found.

### React Flow Warning Cleanup

- NaN `left` CSS warning was addressed.
- React Flow `nodeTypes`/`edgeTypes` warning remains known non-blocking, likely
  React Flow v11/dev behavior.
- Clerk development-key warning remains expected in dev/test.

### Canvas Bugfix

- Commit: `309c994 Fix Commonplace connection UI and drag-back node removal`
- Connection preview now starts from node-side geometry instead of node center.
- Solid/Dashed edge choices are visually explicit.
- Canvas note nodes can be dragged back to Library/sidebar.
- Drag-back removes only the visual node from canvas.
- Original Library note remains.
- Sub Map node DELETE is enabled.
- Main Map node DELETE behavior is preserved.
- Connected visible edges are removed locally.
- Production manual QA confirmed these paths work.

### Phase 9A

- Inventory / saved maps panel added inside map canvas.
- Separate Main Maps and Sub Mind Maps lists.
- Opening saved Main/Sub Maps from Inventory works.
- Active map marker added.
- Route/adapter behavior unchanged.

### Phase 9B

- Inventory navigation hardened.
- Inventory appears only in map views.
- Main -> Main, Main -> Sub, Sub -> Sub, and Sub -> Main switching works.
- Unsaved-change confirmation uses real dirty state, including failed-save
  dirty state.
- No visible "Laci" or "Drawer" copy remains.

### Phase 9C

- Inventory regression audit passed.
- No risks/gaps found.

### Phase 10A

- Local runtime QA passed through a Playwright-managed browser.
- Library, Sub Mind Map, Main Map, Inventory, save/reload, mixed edges,
  drag-back, and data-safety paths passed locally.

### Phase 10B

- Production public/auth/library QA passed.
- Authenticated production canvas automation was blocked by browser drag
  limitations.
- User manually verified production canvas bugfix paths successfully.

### Phase 10C

- Canvas workspace expanded.
- Header vertical pressure reduced.
- React Flow controls remained clickable.
- Inventory does not block controls.

### Phase 10D

- Commonplace-only server-persisted theme settings implemented.
- Remote Supabase migration applied and verified.
- Authenticated production smoke passed.
- Final preference state restored to Default/Default.

## API Routes

- `/api/feedback` - session feedback
- `/api/diagnostic` - diagnostic tests
- `/api/weekly-review` - session trend review
- `/api/mental-model` - micro drills and quality criteria
- `/api/vocabulary-correction` - vocabulary usage feedback
- `/api/article-practice` - URL text processing and prompt generation
- `/api/leaderboard` - user-only sanitized leaderboard
- `/api/commonplace/notes` - Commonplace note CRUD
- `/api/commonplace/maps` - Main/Sub Mind Map registry behavior
- `/api/commonplace/maps/nodes` - visual node list/create/update/delete paths
- `/api/commonplace/maps/edges` - visual edge list/create/update/delete paths

## Database Schema and Cloud Status

- Supabase schema and RLS policies live in `supabase/migrations/`.
- Supabase integration code lives under `app-web/src/app/lib/supabase/` and
  Commonplace storage adapters under `app-web/src/app/lib/storage/`.
- RLS policies expect Clerk JWT subject via `auth.jwt()->>'sub'`.
- Clerk's native Supabase integration is used for database operations.
- Do not commit database credentials.
- Existing core tables include:
  - `profiles`
  - `speaking_sessions`
  - `vocabulary_items`
  - `vocabulary_sentences`
  - `vocabulary_corrections`
  - `xp_profiles`
  - `xp_events`
  - `badges`
  - `global_ai_response_cache`
  - `ai_usage_events`
  - `ai_request_idempotency`
  - `commonplace_notes`
  - `commonplace_shortcode_counters`
  - `commonplace_mindmaps`
  - `commonplace_mindmap_nodes`
  - `commonplace_mindmap_edges`
  - `commonplace_main_map_nodes`
  - `commonplace_main_map_edges`
- `commonplace_mindmap_nodes` allows duplicate Library note instances in the
  same Sub Map. Identity is by node ID, not note ID.
- `commonplace_mindmap_edges.edge_type` supports `solid` and `dashed`.
- Main Map visual node schema supports `node_kind` values `cluster` and `note`.
- Main Map edge schema supports `edge_type` values `solid` and `dashed`.
- `profiles` now stores Commonplace appearance preferences:
  - `commonplace_canvas_color`
  - `commonplace_card_color`
- Remote Supabase Phase 10D migration has been applied and verified.
- RLS and policies were not weakened by Commonplace migrations.

## Local Data and Cloud Boundaries

- Older speaking/vocabulary/gamification features remain local-first.
- Stored primarily in browser `localStorage`:
  - `adaptive-speaking-app:sessions`
  - `adaptive-speaking-app:vocabulary`
  - `adaptive-speaking-app:xp-profile`
  - `adaptive-speaking-app:xp-events`
  - `adaptive-speaking-app:badges`
  - `fonetik:learning-path-progress:v1`
- Clerk/Supabase integration is active as a best-effort signed-in cloud path for
  supported features.
- Cloud restore/import is user-confirmed and conservative.
- During restore/import, local storage is never cleared, cloud data is not
  deleted or mutated, and XP is not recalculated.
- Commonplace note/map data is server-backed and owner-scoped.
- Commonplace theme settings are server-backed in `profiles`.

## Privacy and Security Boundaries

- Provider keys belong only in local/server env files.
- Provider keys must not use `NEXT_PUBLIC_`.
- `.env.local`, `.next`, and `node_modules` must not be committed.
- Supabase migration files are schema-only and must never contain real keys.
- Do not expose secrets, database URLs, passwords, service-role keys, API keys,
  auth tokens, provider payloads, or raw private user data.
- Do not weaken Supabase RLS.
- Do not store raw provider payloads in Commonplace.
- Do not store audio/STT/TTS fields or storage paths in Commonplace notes/maps.
- AI Suggest must not be implemented before a capability/privacy audit.

## Validation Status

Latest relevant local validations across Commonplace phases have passed:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd playwright test tests/commonplace-ui.spec.ts --reporter=line --workers=1`
- Commonplace route tests for notes, maps, map nodes, and map edges where
  relevant
- Supabase/Commonplace adapter tests
- Profile adapter/settings tests where relevant
- `git diff --check`

Runtime validation status:

- Phase 10A local runtime QA passed.
- Phase 10B production public/auth/library QA passed.
- Production manual QA confirmed the canvas bugfix paths.
- Phase 10D authenticated production smoke passed after remote migration.

Known non-blocking warnings:

- React Flow `nodeTypes`/`edgeTypes` warning may appear in dev/test output.
- Clerk development-key warning may appear in dev/test output.
- These are known warnings and are not current blockers.

## Current Hard Rules for Future Agents

- Use "Inventory" for saved map navigation.
- Do not call the current saved-map panel "Laci" or "Drawer".
- Do not collapse multiple Main Maps into one.
- Do not confuse Library notes with visual nodes.
- Do not delete source Library notes when removing canvas visual nodes.
- Do not delete referenced Sub Mind Maps when removing cluster nodes.
- Edges connect visual node IDs, not raw note IDs.
- Do not modify auth, env, package, provider settings, or unrelated features
  unless explicitly requested.
- Do not weaken Supabase RLS.
- Do not expose secrets.
- Do not apply migrations remotely unless explicitly instructed.
- Do not push or deploy without explicit instruction.
- Do not implement autosave unless explicitly scoped.
- Do not implement AI Suggest without a capability/privacy audit first.

## Recommended Next Roadmap

1. Commit this context update if review passes.
2. Run an AI Suggest Capability Audit.
3. Only after audit, decide whether to implement AI Suggest.

AI Suggest must remain:

- user-approved
- no auto-connect
- no semantic auto-edge creation without approval
- no raw provider payload stored
- no unnecessary sensitive data sent to a provider
- safe error handling
- tested with route, UI, and privacy coverage

## Not In Current MVP / Still Future

- AI Suggest
- Semantic auto-edge creation
- Autosave for maps
- Public profile pages
- Full multi-target-language practice
- Mobile app
- Advanced RAG or vector search
- Persisted Weekly Review / Mental Model history
- Pronunciation scoring or audio recording exports
- Article Practice history
- Advanced spaced-repetition algorithm such as SM-2
- Bulk AI classification or tagging of vocabulary items
- Automated generated user answers or sentence templates
