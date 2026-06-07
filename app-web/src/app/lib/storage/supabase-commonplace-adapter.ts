import type { FonetikSupabaseClient } from "../supabase";

const NOTES_TABLE = "commonplace_notes";
const COUNTERS_TABLE = "commonplace_shortcode_counters";
const DEFAULT_SOURCE_BOOK = "Untitled Source";

const MAX_INSIGHT_LENGTH = 4000;
const MAX_SOURCE_PAGE_LENGTH = 80;
const MAX_TITLE_LENGTH = 160;
const MAX_QUOTE_LENGTH = 4000;
const MAX_RELEVANCE_LENGTH = 2000;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;
const MAX_CONNECTIONS = 20;

const STOP_WORDS = new Set(["a", "an", "and", "for", "of", "to"]);

export type CommonplaceError =
  | "commonplace_auth_required"
  | "commonplace_save_failed"
  | "commonplace_validation_failed"
  | "commonplace_not_found";

export type CommonplaceNote = {
  id: string;
  ownerId: string;
  clientId: string | null;
  shortcode: string;
  sourceBook: string;
  sourcePage: string | null;
  title: string | null;
  quote: string | null;
  insight: string;
  tags: string[];
  connections: string[];
  relevance: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommonplaceNoteListItem = CommonplaceNote;

export type CreateCommonplaceNoteInput = {
  ownerId: string;
  clientId?: string | null;
  sourceBook?: string | null;
  sourcePage?: string | null;
  title?: string | null;
  quote?: string | null;
  insight: string;
  tags?: string[] | null;
  connections?: string[] | null;
  relevance?: string | null;
};

export type UpdateCommonplaceNoteInput = {
  ownerId: string;
  noteId: string;
  sourceBook?: string | null;
  sourcePage?: string | null;
  title?: string | null;
  quote?: string | null;
  insight?: string;
  tags?: string[] | null;
  connections?: string[] | null;
  relevance?: string | null;
};

export type CommonplaceNoteResult =
  | { ok: true; note: CommonplaceNote }
  | { ok: false; error: CommonplaceError };

export type CommonplaceNoteListResult =
  | { ok: true; notes: CommonplaceNoteListItem[] }
  | { ok: false; error: CommonplaceError };

export type CommonplaceDeleteResult =
  | { ok: true }
  | { ok: false; error: CommonplaceError };

export type CommonplaceNoteRow = {
  id: string;
  owner_id: string;
  client_id: string | null;
  shortcode: string;
  source_book: string;
  source_page: string | null;
  title: string | null;
  quote: string | null;
  insight: string;
  tags: string[] | null;
  connections: string[] | null;
  relevance: string | null;
  created_at: string;
  updated_at: string;
};

type CommonplaceNoteInsert = {
  owner_id: string;
  client_id: string | null;
  shortcode: string;
  source_book: string;
  source_page: string | null;
  title: string | null;
  quote: string | null;
  insight: string;
  tags: string[];
  connections: string[];
  relevance: string | null;
};

type CommonplaceNoteUpdate = Partial<
  Pick<
    CommonplaceNoteInsert,
    | "source_book"
    | "source_page"
    | "title"
    | "quote"
    | "insight"
    | "tags"
    | "connections"
    | "relevance"
  >
>;

type CounterRow = {
  owner_id: string;
  prefix: string;
  last_value: number;
};

function cleanRequiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanOptionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return undefined;
  return trimmed;
}

function cleanSourceBook(value: unknown): string | null {
  if (value === undefined || value === null) return DEFAULT_SOURCE_BOOK;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SOURCE_BOOK;
}

export function normalizeCommonplaceTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    if (typeof tag !== "string") continue;

    const cleanTag = tag.trim().replace(/^#+/, "").trim().toLowerCase();
    if (
      cleanTag.length === 0 ||
      cleanTag.length > MAX_TAG_LENGTH ||
      seen.has(cleanTag)
    ) {
      continue;
    }

    seen.add(cleanTag);
    normalized.push(cleanTag);
    if (normalized.length >= MAX_TAGS) break;
  }

  return normalized;
}

export function normalizeCommonplaceConnections(
  connections?: string[] | null,
): string[] {
  if (!Array.isArray(connections)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const connection of connections) {
    if (typeof connection !== "string") continue;

    const trimmed = connection.trim();
    if (!trimmed.startsWith("#")) continue;

    const cleanConnection = `#${trimmed.slice(1).trim()}`;
    if (cleanConnection.length <= 1 || seen.has(cleanConnection)) continue;

    seen.add(cleanConnection);
    normalized.push(cleanConnection);
    if (normalized.length >= MAX_CONNECTIONS) break;
  }

  return normalized;
}

function validateCreateInput(
  input: CreateCommonplaceNoteInput,
): { ok: true; row: Omit<CommonplaceNoteInsert, "shortcode"> } | { ok: false } {
  const ownerId = cleanRequiredText(input.ownerId);
  const insight = cleanRequiredText(input.insight);
  const sourceBook = cleanSourceBook(input.sourceBook);
  const sourcePage = cleanOptionalText(input.sourcePage, MAX_SOURCE_PAGE_LENGTH);
  const title = cleanOptionalText(input.title, MAX_TITLE_LENGTH);
  const quote = cleanOptionalText(input.quote, MAX_QUOTE_LENGTH);
  const relevance = cleanOptionalText(input.relevance, MAX_RELEVANCE_LENGTH);

  if (
    !ownerId ||
    !insight ||
    !sourceBook ||
    insight.length > MAX_INSIGHT_LENGTH ||
    (input.sourcePage !== undefined && sourcePage === undefined) ||
    (input.title !== undefined && title === undefined) ||
    (input.quote !== undefined && quote === undefined) ||
    (input.relevance !== undefined && relevance === undefined)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    row: {
      owner_id: ownerId,
      client_id:
        typeof input.clientId === "string" && input.clientId.trim().length > 0
          ? input.clientId.trim()
          : null,
      source_book: sourceBook,
      source_page: sourcePage ?? null,
      title: title ?? null,
      quote: quote ?? null,
      insight,
      tags: normalizeCommonplaceTags(input.tags),
      connections: normalizeCommonplaceConnections(input.connections),
      relevance: relevance ?? null,
    },
  };
}

function validateUpdateInput(
  input: UpdateCommonplaceNoteInput,
): { ok: true; ownerId: string; noteId: string; row: CommonplaceNoteUpdate } | { ok: false } {
  const ownerId = cleanRequiredText(input.ownerId);
  const noteId = cleanRequiredText(input.noteId);
  if (!ownerId || !noteId) return { ok: false };

  const row: CommonplaceNoteUpdate = {};

  if (input.sourceBook !== undefined) {
    const sourceBook = cleanSourceBook(input.sourceBook);
    if (!sourceBook) return { ok: false };
    row.source_book = sourceBook;
  }

  if (input.sourcePage !== undefined) {
    const sourcePage = cleanOptionalText(input.sourcePage, MAX_SOURCE_PAGE_LENGTH);
    if (sourcePage === undefined) return { ok: false };
    row.source_page = sourcePage;
  }

  if (input.title !== undefined) {
    const title = cleanOptionalText(input.title, MAX_TITLE_LENGTH);
    if (title === undefined) return { ok: false };
    row.title = title;
  }

  if (input.quote !== undefined) {
    const quote = cleanOptionalText(input.quote, MAX_QUOTE_LENGTH);
    if (quote === undefined) return { ok: false };
    row.quote = quote;
  }

  if (input.insight !== undefined) {
    const insight = cleanRequiredText(input.insight);
    if (!insight || insight.length > MAX_INSIGHT_LENGTH) return { ok: false };
    row.insight = insight;
  }

  if (input.tags !== undefined) {
    row.tags = normalizeCommonplaceTags(input.tags);
  }

  if (input.connections !== undefined) {
    row.connections = normalizeCommonplaceConnections(input.connections);
  }

  if (input.relevance !== undefined) {
    const relevance = cleanOptionalText(input.relevance, MAX_RELEVANCE_LENGTH);
    if (relevance === undefined) return { ok: false };
    row.relevance = relevance;
  }

  return { ok: true, ownerId, noteId, row };
}

export function mapCommonplaceNoteRow(row: CommonplaceNoteRow): CommonplaceNote {
  return {
    id: row.id,
    ownerId: row.owner_id,
    clientId: row.client_id,
    shortcode: row.shortcode,
    sourceBook: row.source_book,
    sourcePage: row.source_page,
    title: row.title,
    quote: row.quote,
    insight: row.insight,
    tags: row.tags ?? [],
    connections: row.connections ?? [],
    relevance: row.relevance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tokenizeSourceTitle(sourceBookOrTitle: string): string[] {
  return sourceBookOrTitle
    .toLowerCase()
    .replace(/['']/g, "")
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function buildShortcodePrefix(sourceBookOrTitle: string): string {
  const source = cleanSourceBook(sourceBookOrTitle) ?? DEFAULT_SOURCE_BOOK;
  const tokens = tokenizeSourceTitle(source);
  if (tokens.length === 0) return "us";

  let words = tokens.filter((word) => !STOP_WORDS.has(word));

  if (tokens[0] === "the" && !words.includes("the")) {
    words = [tokens[0], ...words];
  }

  if (tokens.join(" ") === "why nations fail") {
    words = ["why", "nations"];
  }

  const prefix = words
    .slice(0, 3)
    .map((word) => word[0])
    .join("");

  return prefix || "us";
}

export function generateCommonplaceShortcode(
  sourceBookOrTitle: string,
  nextValue = 1,
): string {
  const safeValue =
    Number.isInteger(nextValue) && nextValue > 0 ? nextValue : 1;
  return `#${buildShortcodePrefix(sourceBookOrTitle)}${safeValue}`;
}

async function reserveNextShortcode(
  ownerId: string,
  sourceBookOrTitle: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<{ ok: true; shortcode: string } | { ok: false }> {
  const prefix = buildShortcodePrefix(sourceBookOrTitle);

  const { data: counterData, error: counterReadError } = await supabaseClient
    .from(COUNTERS_TABLE)
    .select("owner_id, prefix, last_value")
    .eq("owner_id", ownerId)
    .eq("prefix", prefix)
    .maybeSingle();

  if (counterReadError) return { ok: false };

  const existingCounter = counterData as CounterRow | null;
  const nextValue =
    typeof existingCounter?.last_value === "number"
      ? existingCounter.last_value + 1
      : 1;

  if (existingCounter) {
    const { error: updateError } = await supabaseClient
      .from(COUNTERS_TABLE)
      .update({ last_value: nextValue })
      .eq("owner_id", ownerId)
      .eq("prefix", prefix);

    if (updateError) return { ok: false };
  } else {
    const { error: insertError } = await supabaseClient
      .from(COUNTERS_TABLE)
      .insert({
        owner_id: ownerId,
        prefix,
        last_value: nextValue,
      });

    if (insertError) return { ok: false };
  }

  return {
    ok: true,
    shortcode: generateCommonplaceShortcode(sourceBookOrTitle, nextValue),
  };
}

export async function createCommonplaceNote(
  input: CreateCommonplaceNoteInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceNoteResult> {
  const validated = validateCreateInput(input);
  if (!validated.ok) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const shortcodeResult = await reserveNextShortcode(
      validated.row.owner_id,
      validated.row.source_book,
      supabaseClient,
    );

    if (!shortcodeResult.ok) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    const { data, error } = await supabaseClient
      .from(NOTES_TABLE)
      .insert({
        ...validated.row,
        shortcode: shortcodeResult.shortcode,
      })
      .select("*")
      .single();

    if (error || !data) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return { ok: true, note: mapCommonplaceNoteRow(data as CommonplaceNoteRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function listCommonplaceNotes(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceNoteListResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  if (!cleanOwnerId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(NOTES_TABLE)
      .select("*")
      .eq("owner_id", cleanOwnerId)
      .order("created_at", { ascending: false });

    if (error) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return {
      ok: true,
      notes: ((data as CommonplaceNoteRow[] | null) ?? []).map(
        mapCommonplaceNoteRow,
      ),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function getCommonplaceNoteById(
  ownerId: string,
  noteId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceNoteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanNoteId = cleanRequiredText(noteId);
  if (!cleanOwnerId || !cleanNoteId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(NOTES_TABLE)
      .select("*")
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanNoteId)
      .maybeSingle();

    if (error) return { ok: false, error: "commonplace_save_failed" };
    if (!data) return { ok: false, error: "commonplace_not_found" };

    return { ok: true, note: mapCommonplaceNoteRow(data as CommonplaceNoteRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function getCommonplaceNoteByShortcode(
  ownerId: string,
  shortcode: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceNoteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanShortcode = cleanRequiredText(shortcode);
  if (!cleanOwnerId || !cleanShortcode) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(NOTES_TABLE)
      .select("*")
      .eq("owner_id", cleanOwnerId)
      .eq("shortcode", cleanShortcode)
      .maybeSingle();

    if (error) return { ok: false, error: "commonplace_save_failed" };
    if (!data) return { ok: false, error: "commonplace_not_found" };

    return { ok: true, note: mapCommonplaceNoteRow(data as CommonplaceNoteRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function updateCommonplaceNote(
  input: UpdateCommonplaceNoteInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceNoteResult> {
  const validated = validateUpdateInput(input);
  if (!validated.ok) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(NOTES_TABLE)
      .update(validated.row)
      .eq("owner_id", validated.ownerId)
      .eq("id", validated.noteId)
      .select("*")
      .maybeSingle();

    if (error) return { ok: false, error: "commonplace_save_failed" };
    if (!data) return { ok: false, error: "commonplace_not_found" };

    return { ok: true, note: mapCommonplaceNoteRow(data as CommonplaceNoteRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function deleteCommonplaceNote(
  ownerId: string,
  noteId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceDeleteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanNoteId = cleanRequiredText(noteId);
  if (!cleanOwnerId || !cleanNoteId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { error } = await supabaseClient
      .from(NOTES_TABLE)
      .delete()
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanNoteId);

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}
