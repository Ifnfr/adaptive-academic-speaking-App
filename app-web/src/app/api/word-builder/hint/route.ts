import { NextResponse } from "next/server";
import { resolveCurrentUserId } from "../_lib/route-helpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. Authentication
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 3. Validation
    // If sentence field is missing entirely from body: return 400 with { error: "missing_required_fields" }
    if (body === null || typeof body !== "object" || !("sentence" in body)) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    const {
      locationHint,
      ruleReference,
      guidedCompletion,
      hintLevel,
    } = body;

    // If hintLevel is not 1, 2, or 3: return 400 with { error: "invalid_hint_level" }
    if (hintLevel !== 1 && hintLevel !== 2 && hintLevel !== 3) {
      return NextResponse.json({ error: "invalid_hint_level" }, { status: 400 });
    }

    // If any of these fields are missing or empty string: locationHint, ruleReference, guidedCompletion: return 400 with { error: "incomplete_error_data" }
    if (
      typeof locationHint !== "string" || locationHint.trim() === "" ||
      typeof ruleReference !== "string" || ruleReference.trim() === "" ||
      typeof guidedCompletion !== "string" || guidedCompletion.trim() === ""
    ) {
      return NextResponse.json({ error: "incomplete_error_data" }, { status: 400 });
    }

    // 4. Hint Generation Logic
    if (hintLevel === 1) {
      return NextResponse.json({ hintText: locationHint, hintLevel: 1 });
    }
    if (hintLevel === 2) {
      return NextResponse.json({ hintText: ruleReference, hintLevel: 2 });
    }
    if (hintLevel === 3) {
      return NextResponse.json({
        hintText: `Complete this sentence: "${guidedCompletion}"`,
        hintLevel: 3,
      });
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  } catch (error) {
    console.error("Word Builder Hint Route Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
