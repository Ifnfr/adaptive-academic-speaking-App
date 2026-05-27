/**
 * Supabase vocabulary adapter persistence helpers.
 *
 * This adapter manages mapping and writing of Vocabulary items,
 * practice sentences, and corrections to the cloud.
 */

import type { FonetikSupabaseClient } from "../supabase";
import type {
  VocabItem,
  VocabUserSentence,
  VocabSentenceCorrection,
  VocabPartOfSpeech,
  VocabSource,
  VocabLevel,
  VocabStatus,
  VocabCorrectionStatus,
} from "../vocabulary";

const VOCAB_ITEMS_TABLE = "vocabulary_items";
const VOCAB_SENTENCES_TABLE = "vocabulary_sentences";
const VOCAB_CORRECTIONS_TABLE = "vocabulary_corrections";

export type SupabaseVocabItemRow = {
  id: string;
  owner_id: string;
  client_id: string;
  word: string;
  meaning: string | null;
  part_of_speech: string | null;
  source: string | null;
  level: string | null;
  status: string | null;
  example: string | null;
  collocations: string[] | null;
  reuse_count: number;
  correct_use_count: number;
  last_practiced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseVocabItemInsert = {
  owner_id: string;
  client_id: string;
  word: string;
  meaning?: string;
  part_of_speech?: string;
  source?: string;
  level?: string;
  status?: string;
  example?: string;
  collocations?: string[];
  reuse_count: number;
  correct_use_count: number;
  last_practiced_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SupabaseVocabSentenceRow = {
  id: string;
  owner_id: string;
  vocab_item_id: string;
  client_id: string;
  sentence: string;
  contains_word: boolean;
  created_at: string;
};

export type SupabaseVocabSentenceInsert = {
  owner_id: string;
  vocab_item_id: string;
  client_id: string;
  sentence: string;
  contains_word: boolean;
  created_at?: string;
};

export type SupabaseVocabCorrectionRow = {
  id: string;
  owner_id: string;
  sentence_id: string;
  status: string | null;
  explanation: string | null;
  corrected_sentence: string | null;
  collocation_tip: string | null;
  retry_instruction: string | null;
  target_usage_role: string | null;
  warnings: string[] | null;
  provider_used: string | null;
  checked_at: string;
};

export type SupabaseVocabCorrectionInsert = {
  owner_id: string;
  sentence_id: string;
  status?: string;
  explanation?: string;
  corrected_sentence?: string;
  collocation_tip?: string;
  retry_instruction?: string;
  target_usage_role?: string | null;
  warnings?: string[];
  provider_used?: string;
  checked_at?: string;
};

export function mapStoredVocabToSupabaseInsert(
  ownerId: string,
  item: VocabItem,
): SupabaseVocabItemInsert {
  return {
    owner_id: ownerId,
    client_id: item.id,
    word: item.word,
    meaning: item.meaning,
    part_of_speech: item.partOfSpeech,
    source: item.source,
    level: item.level,
    status: item.status,
    example: item.example,
    collocations: item.collocations,
    reuse_count: item.reuseCount,
    correct_use_count: item.correctUseCount,
    last_practiced_at: item.lastPracticedAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function mapStoredSentenceToSupabaseInsert(
  ownerId: string,
  vocabItemId: string,
  sentence: VocabUserSentence,
): SupabaseVocabSentenceInsert {
  return {
    owner_id: ownerId,
    vocab_item_id: vocabItemId,
    client_id: sentence.id,
    sentence: sentence.sentence,
    contains_word: sentence.containsWord,
    created_at: sentence.createdAt,
  };
}

export function mapStoredCorrectionToSupabaseInsert(
  ownerId: string,
  sentenceId: string,
  correction: VocabSentenceCorrection,
): SupabaseVocabCorrectionInsert {
  return {
    owner_id: ownerId,
    sentence_id: sentenceId,
    status: correction.status,
    explanation: correction.explanation,
    corrected_sentence: correction.correctedSentence,
    collocation_tip: correction.collocationTip,
    retry_instruction: correction.retryInstruction,
    target_usage_role: correction.targetUsageRole ?? null,
    warnings: correction.warnings,
    provider_used: correction.providerUsed,
    checked_at: correction.checkedAt,
  };
}

export function mapSupabaseRowToStoredVocab(
  row: SupabaseVocabItemRow,
  sentences: VocabUserSentence[] = [],
): VocabItem {
  return {
    version: 1,
    id: row.client_id,
    word: row.word,
    meaning: row.meaning ?? "",
    partOfSpeech: (row.part_of_speech as VocabPartOfSpeech) ?? "other",
    source: (row.source as VocabSource) ?? "manual",
    level: (row.level as VocabLevel) ?? "Foundation",
    status: (row.status as VocabStatus) ?? "new",
    example: row.example ?? "",
    collocations: row.collocations ?? [],
    userSentences: sentences,
    reuseCount: row.reuse_count ?? 0,
    correctUseCount: row.correct_use_count ?? 0,
    lastPracticedAt: row.last_practiced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSupabaseRowToStoredSentence(
  row: SupabaseVocabSentenceRow,
  correction?: VocabSentenceCorrection,
): VocabUserSentence {
  return {
    id: row.client_id,
    sentence: row.sentence,
    containsWord: row.contains_word,
    createdAt: row.created_at,
    correction,
  };
}

export function mapSupabaseRowToStoredCorrection(
  row: SupabaseVocabCorrectionRow,
): VocabSentenceCorrection {
  return {
    status: (row.status as VocabCorrectionStatus) ?? "incorrect",
    explanation: row.explanation ?? "",
    correctedSentence: row.corrected_sentence ?? "",
    collocationTip: row.collocation_tip ?? "",
    retryInstruction: row.retry_instruction ?? "",
    targetUsageRole: row.target_usage_role ?? undefined,
    warnings: row.warnings ?? [],
    checkedAt: row.checked_at,
    providerUsed: row.provider_used ?? "",
  };
}

/**
 * Loads vocabulary items, practice sentences, and corrections from Supabase
 * and reconstructs the local nested VocabItem shape. This helper is inactive
 * until future runtime code explicitly calls it; it does not write localStorage
 * or infer deletes.
 */
export async function loadSupabaseVocabulary(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<VocabItem[]> {
  const { data: itemRows, error: itemError } = await supabaseClient
    .from(VOCAB_ITEMS_TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (itemError) {
    throw itemError;
  }

  const { data: sentenceRows, error: sentenceError } = await supabaseClient
    .from(VOCAB_SENTENCES_TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (sentenceError) {
    throw sentenceError;
  }

  const { data: correctionRows, error: correctionError } = await supabaseClient
    .from(VOCAB_CORRECTIONS_TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .order("checked_at", { ascending: true });

  if (correctionError) {
    throw correctionError;
  }

  const correctionsBySentenceId = new Map<string, VocabSentenceCorrection>();
  for (const row of (correctionRows as SupabaseVocabCorrectionRow[] | null) ?? []) {
    correctionsBySentenceId.set(row.sentence_id, mapSupabaseRowToStoredCorrection(row));
  }

  const sentencesByVocabId = new Map<string, VocabUserSentence[]>();
  for (const row of (sentenceRows as SupabaseVocabSentenceRow[] | null) ?? []) {
    const sentences = sentencesByVocabId.get(row.vocab_item_id) ?? [];
    sentences.push(
      mapSupabaseRowToStoredSentence(
        row,
        correctionsBySentenceId.get(row.id),
      ),
    );
    sentencesByVocabId.set(row.vocab_item_id, sentences);
  }

  return ((itemRows as SupabaseVocabItemRow[] | null) ?? []).map((row) =>
    mapSupabaseRowToStoredVocab(row, sentencesByVocabId.get(row.id) ?? []),
  );
}

/**
 * Upserts a vocabulary item and returns its database ID (UUID).
 */
export async function upsertVocabItemRow(
  ownerId: string,
  item: VocabItem,
  supabaseClient: FonetikSupabaseClient,
): Promise<string> {
  const insertData = mapStoredVocabToSupabaseInsert(ownerId, item);
  const { data, error } = await supabaseClient
    .from(VOCAB_ITEMS_TABLE)
    .upsert(insertData, { onConflict: "owner_id,client_id" })
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  if (!data?.id) {
    throw new Error("Failed to retrieve generated UUID for vocabulary item");
  }
  return data.id;
}

/**
 * Upserts vocabulary sentences and returns mapping from client_id to database id.
 */
export async function upsertSentenceRows(
  ownerId: string,
  vocabItemId: string,
  sentences: VocabUserSentence[],
  supabaseClient: FonetikSupabaseClient,
): Promise<Record<string, string>> {
  if (sentences.length === 0) return {};

  const insertData = sentences.map((sentence) =>
    mapStoredSentenceToSupabaseInsert(ownerId, vocabItemId, sentence),
  );

  const { data, error } = await supabaseClient
    .from(VOCAB_SENTENCES_TABLE)
    .upsert(insertData, { onConflict: "owner_id,client_id" })
    .select("id, client_id");

  if (error) {
    throw error;
  }

  const mapping: Record<string, string> = {};
  if (data) {
    for (const row of data) {
      mapping[row.client_id] = row.id;
    }
  }
  return mapping;
}

/**
 * Upserts a vocabulary sentence correction.
 */
export async function upsertCorrectionRow(
  ownerId: string,
  sentenceId: string,
  correction: VocabSentenceCorrection,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  const insertData = mapStoredCorrectionToSupabaseInsert(ownerId, sentenceId, correction);
  const { error } = await supabaseClient
    .from(VOCAB_CORRECTIONS_TABLE)
    .upsert(insertData, { onConflict: "owner_id,sentence_id" });

  if (error) {
    throw error;
  }
}

/**
 * Deletes a vocabulary item and cascade deletes its children.
 */
export async function deleteVocabItemRow(
  ownerId: string,
  clientId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  const { error } = await supabaseClient
    .from(VOCAB_ITEMS_TABLE)
    .delete()
    .eq("owner_id", ownerId)
    .eq("client_id", clientId);

  if (error) {
    throw error;
  }
}
