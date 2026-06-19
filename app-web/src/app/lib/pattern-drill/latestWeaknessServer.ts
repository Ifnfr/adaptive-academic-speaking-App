import { selectLatestWeakness } from "./weaknessSelector";

export async function getLatestWeaknessForUser(
  ownerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  options?: { now?: Date; sourceId?: string }
) {
  let query = supabaseClient
    .from("learner_error_patterns")
    .select("id, owner_id, source_kind, source_id, category, label, evidence, correction, practice_focus, created_at")
    .eq("owner_id", ownerId)
    .eq("source_kind", "podchat");

  if (options?.sourceId) {
    query = query.eq("source_id", options.sourceId);
  }

  const { data: rows, error } = await query
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error("latest_weakness_fetch_failed");
  }

  return selectLatestWeakness(rows, { ownerId, now: options?.now });
}
