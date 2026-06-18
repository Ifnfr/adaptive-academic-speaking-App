import {
  EMPTY_COVERAGE_STATE,
  type CommonplaceMapAurInput,
  type ContextCoverageState,
  type ContextSourceType,
  type ContextUnderstandingState,
  type PodchatAurInput,
} from "./types";

const MAX_SHORT_TEXT = 180;
const MAX_MEDIUM_TEXT = 360;
const MAX_LONG_TEXT = 720;
const MAX_LIST_ITEM_TEXT = 180;
const MAX_CONCEPTS = 8;
const MAX_MAP_FOCUS_NODES = 7;

const FORBIDDEN_KEYS = new Set([
  "apiKey",
  "email",
  "model",
  "ownerId",
  "owner_id",
  "prompt",
  "provider",
  "rawAiInput",
  "rawAiOutput",
  "rawInput",
  "rawOutput",
  "rawPrompt",
  "secret",
  "source_snapshot",
  "transcript",
  "userId",
  "user_id",
]);

function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function clampTextList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  for (const item of value) {
    const text = clampText(item, MAX_LIST_ITEM_TEXT);
    if (text && !output.includes(text)) output.push(text);
    if (output.length >= maxItems) break;
  }
  return output;
}

function hasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item));
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (hasForbiddenKey(nested)) return true;
  }
  return false;
}

function makeCoverage(value: unknown): ContextCoverageState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COVERAGE_STATE };
  }
  const v = value as Record<string, unknown>;
  return {
    mainIdeaExplored: v.mainIdeaExplored === true,
    evidenceExplored: v.evidenceExplored === true,
    implicationsExplored: v.implicationsExplored === true,
    learnerPositionFormed: v.learnerPositionFormed === true,
    counterargumentExplored: v.counterargumentExplored === true,
    synthesisCompleted: v.synthesisCompleted === true,
  };
}

function fallbackForSource(sourceType: ContextSourceType): ContextUnderstandingState {
  if (sourceType === "article") {
    return {
      sourceType,
      discussionFocus: "Discuss the article's main claim and connect it to the learner's own position.",
      keyConcepts: ["main claim", "evidence", "implication"],
      evidenceOrExamples: ["Use one detail from the article brief or speaking task."],
      assumptionsToTest: ["What assumption does the article make?"],
      implications: ["What could happen if the article's claim is accepted?"],
      counterarguments: ["What is one reasonable objection to the article's claim?"],
      learnerLikelyProblem: "The learner may summarize the article without forming a clear position.",
      discussionPath: [
        "State the main claim",
        "Explain one piece of evidence",
        "Form a position",
        "Consider an implication or counterargument",
        "Synthesize the discussion",
      ],
      scope: {
        include: ["article claim", "task instruction", "learner position"],
        exclude: ["full article reconstruction", "memorized quotations"],
      },
      closureCriteria: [
        "The learner explains the main idea",
        "The learner supports a position",
        "The learner can summarize one implication",
      ],
      coverageState: { ...EMPTY_COVERAGE_STATE },
    };
  }

  if (sourceType === "commonplace_map") {
    return {
      sourceType,
      discussionFocus: "Discuss the strongest relationship in the Commonplace map.",
      keyConcepts: ["map focus", "connection", "cluster"],
      evidenceOrExamples: ["Use one node and one edge from the map preview."],
      assumptionsToTest: ["What relationship does the map assume?"],
      implications: ["How does this connection change the learner's understanding?"],
      counterarguments: ["Which node might challenge the main connection?"],
      learnerLikelyProblem: "The learner may describe the map visually without explaining the reasoning between nodes.",
      discussionPath: [
        "Identify the focus of the map",
        "Explain a node connection",
        "Test an assumption",
        "Discuss an implication",
        "Synthesize the map's overall meaning",
      ],
      scope: {
        include: ["bounded focus nodes", "saved edges", "cluster relationships"],
        exclude: ["unbounded full-map traversal", "unrelated notes"],
      },
      closureCriteria: [
        "The learner explains at least one relationship",
        "The learner connects the map to a broader idea",
        "The learner can summarize the map's main insight",
      ],
      coverageState: { ...EMPTY_COVERAGE_STATE },
    };
  }

  return {
    sourceType,
    discussionFocus: "Discuss the central idea from the Commonplace note.",
    keyConcepts: ["central concept", "example", "connection"],
    evidenceOrExamples: ["Use the note insight as the starting point."],
    assumptionsToTest: ["What assumption sits behind this note?"],
    implications: ["How could this idea apply beyond the note?"],
    counterarguments: ["What might complicate this idea?"],
    learnerLikelyProblem: "The learner may repeat the note instead of explaining it in their own words.",
    discussionPath: [
      "Restate the central idea",
      "Add an example",
      "Test an assumption",
      "Explore a wider implication",
      "Synthesize the idea",
    ],
    scope: {
      include: ["note insight", "linked tags", "learner example"],
      exclude: ["unrelated library notes", "raw source text"],
    },
    closureCriteria: [
      "The learner explains the note in their own words",
      "The learner adds one example",
      "The learner can state one implication",
    ],
    coverageState: { ...EMPTY_COVERAGE_STATE },
  };
}

export function buildFallbackUnderstandingState(
  input: PodchatAurInput | ContextSourceType,
): ContextUnderstandingState {
  const sourceType = typeof input === "string" ? input : input.sourceType;
  const base = fallbackForSource(sourceType);

  if (typeof input === "string") return base;

  if (input.sourceType === "article") {
    const title = clampText(input.articleTitle, MAX_SHORT_TEXT);
    const mainIdea = clampText(input.mainIdea || input.articleBrief, MAX_MEDIUM_TEXT);
    return {
      ...base,
      discussionFocus: mainIdea || base.discussionFocus,
      keyConcepts: clampTextList(input.keyPoints, 5).concat(title ? [title] : []).slice(0, MAX_CONCEPTS),
      evidenceOrExamples: [
        clampText(input.speakingTaskInstruction, MAX_MEDIUM_TEXT),
        ...clampTextList(input.targetStructure, 3),
      ].filter(Boolean),
    };
  }

  if (input.sourceType === "commonplace_note") {
    const title = clampText(input.title || input.sourceBook || input.shortcode, MAX_SHORT_TEXT);
    const insight = clampText(input.insight, MAX_MEDIUM_TEXT);
    return {
      ...base,
      discussionFocus: insight || title || base.discussionFocus,
      keyConcepts: clampTextList(input.tags, 6).concat(title ? [title] : []).slice(0, MAX_CONCEPTS),
      evidenceOrExamples: insight ? [insight] : base.evidenceOrExamples,
    };
  }

  const compactMap = compactCommonplaceMap(input);
  return {
    ...base,
    discussionFocus: compactMap.mapTitle || base.discussionFocus,
    keyConcepts: compactMap.focusNodes.map((node) => node.label).slice(0, MAX_CONCEPTS),
    evidenceOrExamples: compactMap.focusNodes
      .map((node) => node.insightExcerpt)
      .filter(Boolean)
      .slice(0, 4),
    scope: {
      include: compactMap.focusNodes.map((node) => node.label).slice(0, MAX_MAP_FOCUS_NODES),
      exclude: compactMap.exclusions,
    },
  };
}

export function compactCommonplaceMap(input: CommonplaceMapAurInput) {
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const focusNodes = nodes.slice(0, MAX_MAP_FOCUS_NODES).map((node) => {
    const clusterTitle = clampText(node.referencedSubMindMapTitle, MAX_SHORT_TEXT);
    const title = clampText(node.title || node.shortcode || clusterTitle, MAX_SHORT_TEXT);
    return {
      visualNodeId: clampText(node.visualNodeId, 80),
      kind: node.nodeKind === "cluster" ? "cluster" : "note",
      label: title || "Untitled node",
      insightExcerpt: clampText(node.insightExcerpt || clusterTitle, MAX_MEDIUM_TEXT),
      tags: clampTextList(node.tags, 4),
    };
  });
  const focusIds = new Set(focusNodes.map((node) => node.visualNodeId).filter(Boolean));
  const focusEdges = edges
    .filter((edge) =>
      focusIds.has(clampText(edge.sourceVisualNodeId, 80)) ||
      focusIds.has(clampText(edge.targetVisualNodeId, 80)),
    )
    .slice(0, 12)
    .map((edge) => ({
      sourceVisualNodeId: clampText(edge.sourceVisualNodeId, 80),
      targetVisualNodeId: clampText(edge.targetVisualNodeId, 80),
      edgeType: edge.edgeType === "dashed" ? "dashed" : "solid",
      label: clampText(edge.label, MAX_SHORT_TEXT),
    }));
  const exclusions = [
    nodes.length > focusNodes.length
      ? `${nodes.length - focusNodes.length} lower-priority map node${nodes.length - focusNodes.length === 1 ? "" : "s"}`
      : "",
    edges.length > focusEdges.length
      ? `${edges.length - focusEdges.length} lower-priority connection${edges.length - focusEdges.length === 1 ? "" : "s"}`
      : "",
  ].filter(Boolean);

  return {
    mapType: input.mapType === "main" ? "main" : "sub",
    mapTitle: clampText(input.mapTitle, MAX_SHORT_TEXT),
    counts: {
      nodes: Number.isFinite(input.counts?.nodes) ? Number(input.counts?.nodes) : nodes.length,
      edges: Number.isFinite(input.counts?.edges) ? Number(input.counts?.edges) : edges.length,
    },
    focusNodes,
    focusEdges,
    exclusions,
  };
}

export function buildCompactAurInput(input: PodchatAurInput): Record<string, unknown> {
  if (input.sourceType === "article") {
    return {
      sourceType: "article",
      articleTitle: clampText(input.articleTitle, MAX_SHORT_TEXT),
      articleBrief: clampText(input.articleBrief, MAX_LONG_TEXT),
      mainIdea: clampText(input.mainIdea, MAX_MEDIUM_TEXT),
      keyPoints: clampTextList(input.keyPoints, 6),
      speakingTaskTitle: clampText(input.speakingTaskTitle, MAX_SHORT_TEXT),
      speakingTaskInstruction: clampText(input.speakingTaskInstruction, MAX_MEDIUM_TEXT),
      targetStructure: clampTextList(input.targetStructure, 6),
      sourceDomain: clampText(input.sourceDomain, MAX_SHORT_TEXT),
    };
  }

  if (input.sourceType === "commonplace_note") {
    return {
      sourceType: "commonplace_note",
      noteId: clampText(input.noteId, 80),
      shortcode: clampText(input.shortcode, 80),
      title: clampText(input.title, MAX_SHORT_TEXT),
      sourceBook: clampText(input.sourceBook, MAX_SHORT_TEXT),
      insight: clampText(input.insight, MAX_LONG_TEXT),
      tags: clampTextList(input.tags, 8),
    };
  }

  return {
    sourceType: "commonplace_map",
    ...compactCommonplaceMap(input),
  };
}

export function parseUnderstandingState(
  value: unknown,
  fallbackInput: PodchatAurInput | ContextSourceType,
): ContextUnderstandingState {
  const fallback = buildFallbackUnderstandingState(fallbackInput);
  if (!value || typeof value !== "object" || Array.isArray(value) || hasForbiddenKey(value)) {
    return fallback;
  }

  const v = value as Record<string, unknown>;
  const sourceType = fallback.sourceType;
  const parsed: ContextUnderstandingState = {
    sourceType,
    discussionFocus: clampText(v.discussionFocus, MAX_MEDIUM_TEXT) || fallback.discussionFocus,
    keyConcepts: clampTextList(v.keyConcepts, MAX_CONCEPTS),
    evidenceOrExamples: clampTextList(v.evidenceOrExamples, 6),
    assumptionsToTest: clampTextList(v.assumptionsToTest, 6),
    implications: clampTextList(v.implications, 6),
    counterarguments: clampTextList(v.counterarguments, 6),
    learnerLikelyProblem:
      clampText(v.learnerLikelyProblem, MAX_MEDIUM_TEXT) || fallback.learnerLikelyProblem,
    discussionPath: clampTextList(v.discussionPath, 6),
    scope: {
      include: clampTextList((v.scope as Record<string, unknown> | undefined)?.include, 8),
      exclude: clampTextList((v.scope as Record<string, unknown> | undefined)?.exclude, 8),
    },
    closureCriteria: clampTextList(v.closureCriteria, 5),
    coverageState: makeCoverage(v.coverageState),
  };

  return {
    ...parsed,
    keyConcepts: parsed.keyConcepts.length ? parsed.keyConcepts : fallback.keyConcepts,
    evidenceOrExamples: parsed.evidenceOrExamples.length
      ? parsed.evidenceOrExamples
      : fallback.evidenceOrExamples,
    assumptionsToTest: parsed.assumptionsToTest.length
      ? parsed.assumptionsToTest
      : fallback.assumptionsToTest,
    implications: parsed.implications.length ? parsed.implications : fallback.implications,
    counterarguments: parsed.counterarguments.length
      ? parsed.counterarguments
      : fallback.counterarguments,
    discussionPath: parsed.discussionPath.length ? parsed.discussionPath : fallback.discussionPath,
    scope: {
      include: parsed.scope.include.length ? parsed.scope.include : fallback.scope.include,
      exclude: parsed.scope.exclude.length ? parsed.scope.exclude : fallback.scope.exclude,
    },
    closureCriteria: parsed.closureCriteria.length
      ? parsed.closureCriteria
      : fallback.closureCriteria,
  };
}

export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

export function parseUnderstandingStateJson(
  text: string,
  fallbackInput: PodchatAurInput | ContextSourceType,
): ContextUnderstandingState {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return buildFallbackUnderstandingState(fallbackInput);
  try {
    return parseUnderstandingState(JSON.parse(jsonText), fallbackInput);
  } catch {
    return buildFallbackUnderstandingState(fallbackInput);
  }
}

export function updateCoverageState(
  current: ContextCoverageState,
  latestUserText: string,
): ContextCoverageState {
  const text = latestUserText.toLowerCase();
  return {
    mainIdeaExplored:
      current.mainIdeaExplored ||
      /\b(main idea|main claim|central idea|the article says|the note means)\b/.test(text),
    evidenceExplored:
      current.evidenceExplored ||
      /\b(evidence|example|for instance|because|according to|the article shows)\b/.test(text),
    implicationsExplored:
      current.implicationsExplored ||
      /\b(implication|therefore|as a result|could lead|this means|consequence)\b/.test(text),
    learnerPositionFormed:
      current.learnerPositionFormed ||
      /\b(i think|i believe|my view|in my opinion|i agree|i disagree)\b/.test(text),
    counterargumentExplored:
      current.counterargumentExplored ||
      /\b(counterargument|however|on the other hand|although|but|objection)\b/.test(text),
    synthesisCompleted:
      current.synthesisCompleted ||
      /\b(to summarize|overall|in conclusion|wrap up|conclude)\b/.test(text),
  };
}

export function formatAurPromptBlock(state: ContextUnderstandingState, responseMode: string): string {
  return [
    "AUR CONTEXT BRIDGE:",
    "- Use Analyze -> Understand -> Respond reasoning internally, but do not mention AUR to the learner.",
    `- Selected Socratic response mode: ${responseMode}.`,
    `- Discussion focus: ${state.discussionFocus}`,
    `- Key concepts: ${state.keyConcepts.join("; ")}`,
    `- Evidence/examples: ${state.evidenceOrExamples.join("; ")}`,
    `- Assumptions to test: ${state.assumptionsToTest.join("; ")}`,
    `- Implications: ${state.implications.join("; ")}`,
    `- Counterarguments: ${state.counterarguments.join("; ")}`,
    `- Likely learner problem: ${state.learnerLikelyProblem}`,
    `- Discussion path: ${state.discussionPath.join(" -> ")}`,
    `- Include: ${state.scope.include.join("; ")}`,
    `- Exclude: ${state.scope.exclude.join("; ")}`,
    `- Closure criteria: ${state.closureCriteria.join("; ")}`,
    "",
    "SOCRATIC MODE RULES:",
    "- ask: Ask one focused question that helps the learner reason from the context.",
    "- explain: Briefly clarify the concept, then ask one checking question.",
    "- challenge: Point out a possible assumption, missing evidence, or causal leap politely.",
    "- synthesize: Summarize the learner's position and offer a natural closing option.",
    "- language_coach: Ask the learner to answer in English and offer a short starter phrase.",
    "",
    "ENGLISH-ONLY POLICY:",
    "- Respond in English.",
    "- If the learner writes mainly Indonesian or unclear English, say: Try answering that in English. You can start with: ...",
    "- Do not translate the whole discussion or correct every minor mistake.",
  ].join("\n");
}
