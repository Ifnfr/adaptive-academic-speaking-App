// =============================================================================
// app-web/src/lib/word-builder/prompt-selector.ts
// Adaptive prompt selection logic. Selects 8 prompts for a session based on
// ThresholdDecisions. Does NOT call any AI API. Pure DB queries + computation.
// =============================================================================

import type { ThresholdDecisions } from "./thresholds";
import type { ErrorCategory } from "./metrics";

interface PromptRow {
  id: string;
  prompt_text: string;
  mode: string;
  implied_structures: string[];
}

export interface PromptSelectionResult {
  prompts: PromptRow[];
  modesUsed: string[];
}

// ---------------------------------------------------------------------------
// Weighted random sampling (without replacement)
// ---------------------------------------------------------------------------

function weightedSample<T>(items: T[], weights: number[], n: number): T[] {
  const result: T[] = [];
  const available = [...items];
  const availableWeights = [...weights];

  for (let i = 0; i < n && available.length > 0; i++) {
    const totalWeight = availableWeights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let idx = 0;
    while (rand > availableWeights[idx] && idx < available.length - 1) {
      rand -= availableWeights[idx];
      idx++;
    }
    result.push(available[idx]);
    available.splice(idx, 1);
    availableWeights.splice(idx, 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Simple random shuffle (Fisher-Yates)
// ---------------------------------------------------------------------------

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Simple random sample (without replacement)
// ---------------------------------------------------------------------------

function randomSample<T>(items: T[], n: number): T[] {
  return shuffle(items).slice(0, n);
}

// ---------------------------------------------------------------------------
// Parse implied_structures from either a JSON string or a JS array
// ---------------------------------------------------------------------------

function parseImpliedStructures(raw: any): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // ignore parse errors
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function selectPromptsForSession(
  supabase: any,
  userId: string,
  decisions: ThresholdDecisions,
  recentPromptIds: string[]
): Promise<PromptSelectionResult> {
  const { boostCategories, deterioratingCategories, semiFreeModeUnlocked, transferTestModeUnlocked } = decisions;

  // -------------------------------------------------------------------------
  // Step 1 — Determine mode distribution
  // -------------------------------------------------------------------------
  let guidedCount: number;
  let semiFreeCount: number;
  let transferCount: number;

  if (transferTestModeUnlocked) {
    guidedCount = 6;
    semiFreeCount = 1;
    transferCount = 1;
  } else if (semiFreeModeUnlocked) {
    guidedCount = 6;
    semiFreeCount = 2;
    transferCount = 0;
  } else {
    guidedCount = 8;
    semiFreeCount = 0;
    transferCount = 0;
  }

  const modesToFetch: string[] = ["guided"];
  if (semiFreeCount > 0) modesToFetch.push("semi_free");
  if (transferCount > 0) modesToFetch.push("transfer");

  // -------------------------------------------------------------------------
  // Step 2 — Fetch candidate prompts (excluding recent)
  // -------------------------------------------------------------------------
  async function fetchCandidates(excludeIds: string[]): Promise<PromptRow[]> {
    let query = supabase
      .from("word_builder_prompts")
      .select("id, prompt_text, mode, implied_structures")
      .in("mode", modesToFetch);

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error("selectPromptsForSession: failed to fetch candidates", error);
      return [];
    }
    return data as PromptRow[];
  }

  let candidates = await fetchCandidates(recentPromptIds);

  // -------------------------------------------------------------------------
  // Step 3 — Weighted selection for guided prompts
  // -------------------------------------------------------------------------
  const guidedCandidates = candidates.filter((p) => p.mode === "guided");

  const boostSet = new Set<string>(boostCategories);
  const deterioratingSet = new Set<string>(deterioratingCategories);

  const guidedWeights = guidedCandidates.map((p) => {
    const structures = parseImpliedStructures(p.implied_structures);
    let weight = 1;
    for (const structure of structures) {
      if (boostSet.has(structure)) weight += 2;
      if (deterioratingSet.has(structure)) weight += 3;
    }
    return weight;
  });

  let selectedGuided: PromptRow[] = [];
  if (guidedCandidates.length >= guidedCount) {
    selectedGuided = weightedSample(guidedCandidates, guidedWeights, guidedCount);
  } else {
    // Not enough guided prompts — will handle fallback below
    selectedGuided = guidedCandidates;
  }

  // -------------------------------------------------------------------------
  // Step 4 — Select semi_free and transfer prompts (simple random)
  // -------------------------------------------------------------------------
  const semiFreeCandidates = candidates.filter((p) => p.mode === "semi_free");
  const transferCandidates = candidates.filter((p) => p.mode === "transfer");

  let selectedSemiFree = randomSample(semiFreeCandidates, semiFreeCount);
  let selectedTransfer = randomSample(transferCandidates, transferCount);

  // -------------------------------------------------------------------------
  // Step 5 — Fallback: re-fetch without exclusion if pool is insufficient
  // -------------------------------------------------------------------------
  const totalSelected =
    selectedGuided.length + selectedSemiFree.length + selectedTransfer.length;
  const totalNeeded = guidedCount + semiFreeCount + transferCount;

  if (totalSelected < totalNeeded) {
    // Re-fetch everything without recentPromptIds exclusion
    const fallbackCandidates = await fetchCandidates([]);

    // Track IDs already selected to avoid exact duplicates within this session
    const alreadySelectedIds = new Set([
      ...selectedGuided,
      ...selectedSemiFree,
      ...selectedTransfer,
    ].map((p) => p.id));

    // Top up guided
    if (selectedGuided.length < guidedCount) {
      const need = guidedCount - selectedGuided.length;
      const fallbackGuided = fallbackCandidates.filter(
        (p) => p.mode === "guided" && !alreadySelectedIds.has(p.id)
      );
      const fallbackGuidedWeights = fallbackGuided.map((p) => {
        const structures = parseImpliedStructures(p.implied_structures);
        let weight = 1;
        for (const structure of structures) {
          if (boostSet.has(structure)) weight += 2;
          if (deterioratingSet.has(structure)) weight += 3;
        }
        return weight;
      });
      const extra = weightedSample(fallbackGuided, fallbackGuidedWeights, need);
      extra.forEach((p) => alreadySelectedIds.add(p.id));
      selectedGuided = [...selectedGuided, ...extra];
    }

    // Top up semi_free
    if (selectedSemiFree.length < semiFreeCount) {
      const need = semiFreeCount - selectedSemiFree.length;
      const fallbackSemiFree = fallbackCandidates.filter(
        (p) => p.mode === "semi_free" && !alreadySelectedIds.has(p.id)
      );
      const extra = randomSample(fallbackSemiFree, need);
      extra.forEach((p) => alreadySelectedIds.add(p.id));
      selectedSemiFree = [...selectedSemiFree, ...extra];
    }

    // Top up transfer
    if (selectedTransfer.length < transferCount) {
      const need = transferCount - selectedTransfer.length;
      const fallbackTransfer = fallbackCandidates.filter(
        (p) => p.mode === "transfer" && !alreadySelectedIds.has(p.id)
      );
      const extra = randomSample(fallbackTransfer, need);
      selectedTransfer = [...selectedTransfer, ...extra];
    }
  }

  // -------------------------------------------------------------------------
  // Step 6 — Combine and shuffle final selection
  // -------------------------------------------------------------------------
  const combined = [...selectedGuided, ...selectedSemiFree, ...selectedTransfer];
  const shuffledPrompts = shuffle(combined);

  // -------------------------------------------------------------------------
  // Step 7 — Return
  // -------------------------------------------------------------------------
  return {
    prompts: shuffledPrompts,
    modesUsed: [...new Set(shuffledPrompts.map((p) => p.mode))],
  };
}
