import type { PodchatDifficulty } from "./podchat";

export type PodchatDifficultyEstimateSource =
  | "article"
  | "commonplace_note"
  | "commonplace_map";

export type PodchatDifficultyEstimate = {
  difficulty: PodchatDifficulty;
  source: PodchatDifficultyEstimateSource;
  reasonCode:
    | "fallback_intermediate"
    | "simple_context"
    | "moderate_context"
    | "academic_context"
    | "dense_relational_context";
  confidence: "low" | "medium" | "high";
  score: number;
};

export type PodchatDifficultyEstimateInput =
  | {
      source: "article";
      articleTitle?: string;
      articleBrief?: string;
      mainIdea?: string;
      keyPoints?: string[];
      speakingTaskTitle?: string;
      speakingTaskInstruction?: string;
      targetStructure?: string[];
      sourceDomain?: string;
    }
  | {
      source: "commonplace_note";
      title?: string;
      sourceBook?: string;
      insight?: string;
      tags?: string[];
    }
  | {
      source: "commonplace_map";
      mapTitle?: string;
      mapType?: "sub" | "main";
      counts?: {
        nodes?: number;
        edges?: number;
        clusterNodes?: number;
        noteNodes?: number;
      };
      nodes?: Array<{
        title?: string | null;
        sourceBook?: string;
        insightExcerpt?: string;
        tags?: string[];
        referencedSubMindMapTitle?: string;
      }>;
      edges?: Array<{
        label?: string | null;
      }>;
    };

const ACADEMIC_TERMS = [
  "abstract",
  "assumption",
  "causality",
  "constraint",
  "counterargument",
  "evidence",
  "framework",
  "implication",
  "incentive",
  "model",
  "policy",
  "system",
  "theory",
  "trade-off",
];

const ARGUMENT_TERMS = [
  "although",
  "as a result",
  "because",
  "however",
  "in contrast",
  "therefore",
  "whereas",
];

function compactText(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function countTerms(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
}

function textStats(text: string) {
  const words = text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g) ?? [];
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  return {
    wordCount,
    averageSentenceLength: wordCount / sentenceCount,
    academicHits: countTerms(text, ACADEMIC_TERMS),
    argumentHits: countTerms(text, ARGUMENT_TERMS),
  };
}

function scoreText(text: string, conceptCount: number) {
  const stats = textStats(text);
  let score = 0;
  if (stats.wordCount >= 450) score += 3;
  else if (stats.wordCount >= 180) score += 2;
  else if (stats.wordCount >= 60) score += 1;

  if (stats.averageSentenceLength >= 28) score += 2;
  else if (stats.averageSentenceLength >= 18) score += 1;

  if (stats.academicHits >= 5) score += 2;
  else if (stats.academicHits >= 2) score += 1;

  if (stats.argumentHits >= 4) score += 2;
  else if (stats.argumentHits >= 2) score += 1;

  if (conceptCount >= 6) score += 2;
  else if (conceptCount >= 3) score += 1;

  return { score, stats };
}

function difficultyFromScore(score: number, strongSignals: number): PodchatDifficulty {
  if (score <= 4) return "Intermediate";
  if (score <= 8) return "Advanced";
  return strongSignals >= 2 ? "Expert" : "Advanced";
}

function reasonFor(difficulty: PodchatDifficulty, score: number): PodchatDifficultyEstimate["reasonCode"] {
  if (score === 0) return "fallback_intermediate";
  if (difficulty === "Beginner") return "simple_context";
  if (difficulty === "Intermediate") return "moderate_context";
  if (difficulty === "Advanced") return "academic_context";
  return "dense_relational_context";
}

function confidenceFor(score: number): PodchatDifficultyEstimate["confidence"] {
  if (score <= 2) return "low";
  if (score <= 6) return "medium";
  return "high";
}

export function estimatePodchatDifficulty(
  input: PodchatDifficultyEstimateInput,
): PodchatDifficultyEstimate {
  if (input.source === "commonplace_map") {
    const nodeTexts = input.nodes?.flatMap((node) => [
      node.title ?? "",
      node.sourceBook ?? "",
      node.insightExcerpt ?? "",
      node.referencedSubMindMapTitle ?? "",
      ...(node.tags ?? []),
    ]) ?? [];
    const edgeTexts = input.edges?.map((edge) => edge.label ?? "") ?? [];
    const text = compactText([input.mapTitle, ...nodeTexts, ...edgeTexts]);
    const nodes = input.counts?.nodes ?? input.nodes?.length ?? 0;
    const edges = input.counts?.edges ?? input.edges?.length ?? 0;
    const clusters = input.counts?.clusterNodes ?? 0;
    const density = nodes > 0 ? edges / nodes : 0;
    const { score: textScore, stats } = scoreText(text, nodes + edges + clusters);
    let score = Math.min(textScore, 5);
    if (nodes >= 14) score += 3;
    else if (nodes >= 8) score += 2;
    else if (nodes >= 4) score += 1;
    if (edges >= 16) score += 3;
    else if (edges >= 8) score += 2;
    else if (edges >= 3) score += 1;
    if (density >= 1.3 && nodes >= 6) score += 2;
    else if (density >= 0.8 && nodes >= 4) score += 1;
    if (clusters >= 4) score += 2;
    else if (clusters >= 2) score += 1;
    const strongSignals = [
      stats.wordCount >= 450,
      stats.academicHits + stats.argumentHits >= 6,
      nodes >= 10 && edges >= 10,
      density >= 1.2 && nodes >= 8,
      clusters >= 3,
    ].filter(Boolean).length;
    const difficulty = score === 0 ? "Intermediate" : difficultyFromScore(score, strongSignals);
    return {
      difficulty,
      source: input.source,
      reasonCode: reasonFor(difficulty, score),
      confidence: score === 0 ? "low" : confidenceFor(score),
      score,
    };
  }

  const text =
    input.source === "article"
      ? compactText([
          input.articleTitle,
          input.articleBrief,
          input.mainIdea,
          ...(input.keyPoints ?? []),
          input.speakingTaskTitle,
          input.speakingTaskInstruction,
          ...(input.targetStructure ?? []),
          input.sourceDomain,
        ])
      : compactText([
          input.title,
          input.sourceBook,
          input.insight,
          ...(input.tags ?? []),
        ]);
  const conceptCount =
    input.source === "article"
      ? (input.keyPoints?.length ?? 0) + (input.targetStructure?.length ?? 0)
      : input.tags?.length ?? 0;
  const { score, stats } = scoreText(text, conceptCount);
  const strongSignals = [
    stats.wordCount >= 450,
    stats.academicHits + stats.argumentHits >= 6,
    conceptCount >= 6,
  ].filter(Boolean).length;
  const difficulty = score === 0 ? "Intermediate" : difficultyFromScore(score, strongSignals);
  return {
    difficulty,
    source: input.source,
    reasonCode: reasonFor(difficulty, score),
    confidence: score === 0 ? "low" : confidenceFor(score),
    score,
  };
}
