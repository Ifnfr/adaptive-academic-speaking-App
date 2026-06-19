export type TurnResult = {
  phase: 1 | 2 | 3;
  // Phase 1 specific
  detected?: boolean;
  // Phase 2 specific
  credit?: "full" | "partial" | "none";
  missingSteps?: string[];
  usedSteps?: string[];
  shortFeedback?: string;
  topic?: string;
  attemptNumber?: 1 | 2 | 3;
  simplifiedTopicUsed?: boolean;
  // Phase 3 specific
  patternDetected?: boolean;
  timedOut?: boolean;
  roundSeconds?: number;
  roundIndex?: number;
  startLatencyMs?: number;
  pressurePassed?: boolean;
};

export type DrillBriefContent = {
  briefId: string;
  title: string;
  focus: string;
  qualityCriteria: string[];
  responsePattern: {
    name: string;
    steps: string[];
    spokenModelFragment: string;
  };
  miniExample: string;
  commonMistakes: string[];
  weaknessLabel?: string;
  weaknessDescription?: string;
};

export type DrillSessionState = {
  sessionId: string;
  currentPhase: 0 | 1 | 2 | 3 | "complete";
  briefContent: DrillBriefContent | null;
  phase1Results: TurnResult[];
  phase2Results: TurnResult[];
  phase3Results: TurnResult[];
  entryPhase: 1 | 3 | null;
};

export type QuickCheckResult = {
  result: "detected" | "not_detected_or_partial";
  entryPhase: 1 | 3;
};
