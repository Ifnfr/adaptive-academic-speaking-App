import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateFillBlank } from "../../../../../../../lib/listening-exercise/evaluation/fillBlankEvaluator";
import { sanitizeText } from "../../../../../../../lib/listening-exercise/evaluation/textSanitizer";

export const runtime = "nodejs";

interface SubmitQuestion {
  id: string;
  question_type: "true_false" | "multiple_choice" | "fill_blank";
  question_text: string;
  answer: string;
  accepted_variants?: string[];
  cefr_level?: string;
}

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; sectionId: string }> }
) {
  const { sessionId, sectionId } = await params;

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const b = parsedBody as Record<string, unknown>;
  const userAnswers = (b.answers as Record<string, string>) || {};

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

  // Fetch section data to verify index and retrieve planned questions
  const { data: section, error: sectionError } = await supabase
    .from("listening_exercise_sections")
    .select("questions, cefr_level, session_id")
    .eq("id", sectionId)
    .eq("owner_id", ownerId)
    .single();

  if (sectionError || !section) {
    console.error("Failed to query section data:", sectionError);
    return NextResponse.json(
      { error: "Section not found or unauthorized access." },
      { status: 404 }
    );
  }

  if (section.session_id !== sessionId) {
    return NextResponse.json(
      { error: "Section does not belong to this session." },
      { status: 400 }
    );
  }

  const questions = (section.questions as SubmitQuestion[]) || [];
  let correctCount = 0;
  const attemptsToInsert = [];

  for (const q of questions) {
    const userAnswerRaw = userAnswers[q.id] || "";
    let isCorrect = false;

    if (q.question_type === "fill_blank") {
      // Use core dynamic Levenshtein typo scoring logic
      const evalRes = evaluateFillBlank(
        userAnswerRaw,
        q.answer,
        q.accepted_variants || []
      );
      isCorrect = evalRes.isCorrect;
    } else {
      // Standard exact match for true_false and multiple_choice (case-insensitive & trimmed)
      const sanitizedUser = sanitizeText(userAnswerRaw);
      const sanitizedCorrect = sanitizeText(q.answer);
      isCorrect = sanitizedUser === sanitizedCorrect;
    }

    if (isCorrect) {
      correctCount++;
    }

    attemptsToInsert.push({
      section_id: sectionId,
      owner_id: ownerId,
      question_id: q.id,
      question_type: q.question_type,
      cefr_level: q.cefr_level || section.cefr_level,
      is_correct: isCorrect,
      raw_answer: userAnswerRaw,
    });
  }

  // Insert attempts into attempts table
  if (attemptsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("listening_exercise_question_attempts")
      .insert(attemptsToInsert);

    if (insertError) {
      console.error("Failed to insert question attempts:", insertError);
      return NextResponse.json(
        { error: "Database operation failed. Please try again." },
        { status: 500 }
      );
    }
  }

  // Calculate percentage correct score
  const totalCount = questions.length;
  const sectionScore = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  // Update section row with user answers and section score
  const { error: updateError } = await supabase
    .from("listening_exercise_sections")
    .update({
      answers: userAnswers,
      section_score: sectionScore,
    })
    .eq("id", sectionId);

  if (updateError) {
    console.error("Failed to update section score:", updateError);
    return NextResponse.json(
      { error: "Database operation failed. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    correct_count: correctCount,
    total_count: totalCount,
    section_score: sectionScore,
  });
}
