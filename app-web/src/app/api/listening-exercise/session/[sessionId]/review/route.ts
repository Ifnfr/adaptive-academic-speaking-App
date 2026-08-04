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

// ---------------------------------------------------------------------------
// JSON shapes stored in listening_exercise_sections.questions (jsonb array)
// ---------------------------------------------------------------------------
type StoredQuestion = {
  id: string;
  question_type: "fill_blank" | "multiple_choice" | "true_false";
  question_text: string;
  options?: string[];
  answer: string;
  accepted_variants?: string[];
  sub_skill?: string;
  testing_fact_unit_id?: string;
};

// ---------------------------------------------------------------------------
// JSON shape stored in listening_exercise_sections.fact_units (jsonb array)
// ---------------------------------------------------------------------------
type StoredFactUnit = {
  id: string;
  text: string;
};

// ---------------------------------------------------------------------------
// Row types returned by Supabase queries
// ---------------------------------------------------------------------------
type SectionRow = {
  id: string;
  section_index: number;
  topic: string | null;
  questions: StoredQuestion[] | null;
  fact_units: StoredFactUnit[] | null;
};

type AttemptRow = {
  question_id: string;
  section_id: string;
  is_correct: boolean;
  raw_answer: string | null;
};

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------
type ReviewQuestion = {
  questionId: string;
  questionType: "fill_blank" | "multiple_choice" | "true_false";
  questionText: string;
  options?: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
};

type ReviewSection = {
  sectionIndex: number;
  topic: string;
  questions: ReviewQuestion[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 }
    );
  }

  // 1. Authenticate
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Unauthorized: Missing valid session credentials." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Internal Server Error: Database client configuration missing." },
      { status: 500 }
    );
  }

  // 2. Verify the session belongs to this user
  const { data: sessionRow, error: sessionError } = await supabase
    .from("listening_exercise_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (sessionError) {
    console.error("review: session ownership check failed:", sessionError);
    return NextResponse.json(
      { error: "Database operation failed. Please try again." },
      { status: 500 }
    );
  }

  if (!sessionRow) {
    return NextResponse.json(
      { error: "Session not found or access denied." },
      { status: 404 }
    );
  }

  // 3. Fetch all sections for this session, ordered by section_index asc
  const { data: sections, error: sectionsError } = await supabase
    .from("listening_exercise_sections")
    .select("id, section_index, topic, questions, fact_units")
    .eq("session_id", sessionId)
    .order("section_index", { ascending: true });

  if (sectionsError) {
    console.error("review: sections fetch failed:", sectionsError);
    return NextResponse.json(
      { error: "Failed to fetch section data." },
      { status: 500 }
    );
  }

  if (!sections || sections.length === 0) {
    return NextResponse.json(
      { error: "No sections found for this session." },
      { status: 404 }
    );
  }

  const typedSections = sections as SectionRow[];

  // 4. Fetch all attempts for all section ids in one query
  const sectionIds = typedSections.map((s) => s.id);

  const { data: attempts, error: attemptsError } = await supabase
    .from("listening_exercise_question_attempts")
    .select("question_id, section_id, is_correct, raw_answer")
    .in("section_id", sectionIds);

  if (attemptsError) {
    console.error("review: attempts fetch failed:", attemptsError);
    return NextResponse.json(
      { error: "Failed to fetch attempt data." },
      { status: 500 }
    );
  }

  const typedAttempts = (attempts ?? []) as AttemptRow[];

  // Build a lookup map: `${sectionId}:${questionId}` → AttemptRow
  const attemptMap = new Map<string, AttemptRow>();
  for (const attempt of typedAttempts) {
    attemptMap.set(`${attempt.section_id}:${attempt.question_id}`, attempt);
  }

  // 5. Assemble the response, section by section
  const reviewSections: ReviewSection[] = typedSections.map((section) => {
    const sectionQuestions = section.questions ?? [];
    const factUnits = section.fact_units ?? [];

    // Build a lookup map: fact_unit.id → text
    const factUnitMap = new Map<string, string>();
    for (const fact of factUnits) {
      if (fact.id && fact.text) {
        factUnitMap.set(fact.id, fact.text);
      }
    }

    const reviewQuestions: ReviewQuestion[] = sectionQuestions.map((q) => {
      const attempt = attemptMap.get(`${section.id}:${q.id}`) ?? null;
      const explanation =
        q.testing_fact_unit_id != null
          ? (factUnitMap.get(q.testing_fact_unit_id) ?? null)
          : null;

      const reviewQuestion: ReviewQuestion = {
        questionId: q.id,
        questionType: q.question_type,
        questionText: q.question_text,
        correctAnswer: q.answer,
        userAnswer: attempt?.raw_answer ?? null,
        isCorrect: attempt != null ? attempt.is_correct : null,
        explanation,
      };

      // Only include `options` for multiple_choice questions
      if (q.question_type === "multiple_choice" && Array.isArray(q.options)) {
        reviewQuestion.options = q.options;
      }

      return reviewQuestion;
    });

    return {
      sectionIndex: section.section_index,
      topic: section.topic ?? "",
      questions: reviewQuestions,
    };
  });

  // 6. Return assembled review data
  return NextResponse.json({ sections: reviewSections });
}
