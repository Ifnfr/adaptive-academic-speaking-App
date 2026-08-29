import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

// Tables scoped by owner_id, in the prescribed deletion order.
// ON DELETE CASCADE handles all child rows (e.g. podchat_turns, vocabulary_sentences,
// commonplace_mindmap_nodes, listening_exercise_sections, etc.) automatically —
// we only delete the 18 parent tables listed here.
const OWNER_ID_TABLES = [
  "speaking_sessions",
  "vocabulary_items",
  "xp_profiles",
  "xp_events",
  "badges",
  "article_practice_records",
  "ai_usage_events",
  "podchat_sessions",
  "article_writing_sessions",
  "learner_error_patterns",
  "weekly_reviews",
  "commonplace_notes",
  "commonplace_mindmaps",
  "commonplace_shortcode_counters",
  "weekly_mission_reviews",
  "listening_exercise_sessions",
  "contextual_tips_cache",
] as const;

const STORAGE_BUCKET = "listening-audio";
const STORAGE_PAGE_SIZE = 100;

export async function POST() {
  // 1. Authenticate
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Unauthorized: Missing valid session credentials." },
      { status: 401 }
    );
  }

  // 2. Get service-role Supabase client
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Internal Server Error: Database client configuration missing." },
      { status: 500 }
    );
  }

  // 3. Delete rows from the 18 owner_id-scoped tables, in prescribed order.
  //    Fail fast — any error stops the operation and identifies the failing table.
  for (const table of OWNER_ID_TABLES) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("owner_id", ownerId);

    if (error) {
      console.error(`reset-usage-data: delete failed on table "${table}":`, error);
      return NextResponse.json(
        {
          error: `Database delete failed on table "${table}".`,
          detail: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }
  }

  // 4. (word_builder_sessions was removed when Word Builder feature was deleted.)
  // 5. Delete all Storage objects under listening/${ownerId}/ in "listening-audio".
  //
  //    Supabase Storage list() only returns immediate-level entries — the first
  //    level under "listening/${ownerId}/" yields session-id folder placeholders
  //    (entries with id === null, not real files). The actual .mp3 objects live
  //    one level deeper: listening/${ownerId}/${sessionId}/${sectionId}.mp3
  //
  //    Strategy: two-level listing with pagination at both levels.
  //      Level 1: list session-id "folders" under listening/${ownerId}/
  //      Level 2: for each session folder, list its .mp3 files
  //    Then call remove() with all collected real file paths.
  const userPrefix = `listening/${ownerId}/`;
  const allFilePaths: string[] = [];

  // --- Level 1: collect all session-id folder names ---
  let sessionOffset = 0;
  while (true) {
    const { data: sessionFolders, error: sessionListError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(userPrefix, { limit: STORAGE_PAGE_SIZE, offset: sessionOffset });

    if (sessionListError) {
      console.error(
        `reset-usage-data: storage level-1 list failed for prefix "${userPrefix}":`,
        sessionListError
      );
      return NextResponse.json(
        {
          error: `Storage list failed for prefix "${userPrefix}".`,
          detail: sessionListError.message,
        },
        { status: 500 }
      );
    }

    if (!sessionFolders || sessionFolders.length === 0) {
      break;
    }

    // --- Level 2: for each session folder, list and collect the real .mp3 files ---
    for (const sessionEntry of sessionFolders) {
      // Folder placeholder entries have id === null; skip anything that is
      // unexpectedly a real file at this level (id !== null).
      const sessionPrefix = `${userPrefix}${sessionEntry.name}/`;
      let fileOffset = 0;

      while (true) {
        const { data: sectionFiles, error: fileListError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .list(sessionPrefix, { limit: STORAGE_PAGE_SIZE, offset: fileOffset });

        if (fileListError) {
          console.error(
            `reset-usage-data: storage level-2 list failed for prefix "${sessionPrefix}":`,
            fileListError
          );
          return NextResponse.json(
            {
              error: `Storage list failed for prefix "${sessionPrefix}".`,
              detail: fileListError.message,
            },
            { status: 500 }
          );
        }

        if (!sectionFiles || sectionFiles.length === 0) {
          break;
        }

        for (const file of sectionFiles) {
          // Only collect real objects (id !== null); skip any unexpected sub-folders
          if (file.id !== null) {
            allFilePaths.push(`${sessionPrefix}${file.name}`);
          }
        }

        if (sectionFiles.length < STORAGE_PAGE_SIZE) {
          break;
        }

        fileOffset += STORAGE_PAGE_SIZE;
      }
    }

    if (sessionFolders.length < STORAGE_PAGE_SIZE) {
      break;
    }

    sessionOffset += STORAGE_PAGE_SIZE;
  }

  if (allFilePaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(allFilePaths);

    if (removeError) {
      console.error(
        `reset-usage-data: storage remove failed for ${allFilePaths.length} objects under "${userPrefix}":`,
        removeError
      );
      return NextResponse.json(
        {
          error: `Storage remove failed for objects under "${userPrefix}".`,
          detail: removeError.message,
          objectCount: allFilePaths.length,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    {
      success: true,
      deletedStorageObjects: allFilePaths.length,
    },
    { status: 200 }
  );
}

