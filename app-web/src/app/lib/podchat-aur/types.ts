export type ContextSourceType =
  | "article"
  | "commonplace_note"
  | "commonplace_map";

export type SocraticResponseMode =
  | "ask"
  | "explain"
  | "challenge"
  | "synthesize"
  | "language_coach";

export type ContextCoverageState = {
  mainIdeaExplored: boolean;
  evidenceExplored: boolean;
  implicationsExplored: boolean;
  learnerPositionFormed: boolean;
  counterargumentExplored: boolean;
  synthesisCompleted: boolean;
};

export type ContextUnderstandingState = {
  sourceType: ContextSourceType;
  discussionFocus: string;
  keyConcepts: string[];
  evidenceOrExamples: string[];
  assumptionsToTest: string[];
  implications: string[];
  counterarguments: string[];
  learnerLikelyProblem: string;
  discussionPath: string[];
  scope: {
    include: string[];
    exclude: string[];
  };
  closureCriteria: string[];
  coverageState: ContextCoverageState;
};

export type ArticleAurInput = {
  sourceType: "article";
  articleTitle?: string;
  articleBrief?: string;
  mainIdea?: string;
  keyPoints?: string[];
  speakingTaskTitle?: string;
  speakingTaskInstruction?: string;
  targetStructure?: string[];
  sourceDomain?: string;
};

export type CommonplaceNoteAurInput = {
  sourceType: "commonplace_note";
  noteId?: string;
  shortcode?: string;
  title?: string;
  sourceBook?: string;
  insight?: string;
  tags?: string[];
};

export type CommonplaceMapAurInput = {
  sourceType: "commonplace_map";
  mapType?: "sub" | "main";
  mapId?: string;
  mapTitle?: string;
  counts?: {
    nodes?: number;
    edges?: number;
    clusterNodes?: number;
    noteNodes?: number;
    truncatedNodes?: boolean;
    truncatedEdges?: boolean;
  };
  nodes?: Array<{
    visualNodeId?: string;
    nodeKind?: "note" | "cluster";
    noteId?: string;
    shortcode?: string;
    title?: string | null;
    sourceBook?: string;
    insightExcerpt?: string;
    tags?: string[];
    referencedSubMindMapId?: string;
    referencedSubMindMapTitle?: string;
  }>;
  edges?: Array<{
    sourceVisualNodeId?: string;
    targetVisualNodeId?: string;
    edgeType?: "solid" | "dashed";
    label?: string | null;
  }>;
};

export type PodchatAurInput =
  | ArticleAurInput
  | CommonplaceNoteAurInput
  | CommonplaceMapAurInput;

export type SocraticRoutingInput = {
  latestUserText: string;
  difficulty: string;
  understandingState: ContextUnderstandingState;
};

export const EMPTY_COVERAGE_STATE: ContextCoverageState = {
  mainIdeaExplored: false,
  evidenceExplored: false,
  implicationsExplored: false,
  learnerPositionFormed: false,
  counterargumentExplored: false,
  synthesisCompleted: false,
};
