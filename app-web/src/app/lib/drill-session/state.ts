import type { DrillSessionState, DrillBriefContent, TurnResult } from "./types";

export function createInitialState(
  sessionId: string,
  briefContent: DrillBriefContent | null,
): DrillSessionState {
  return {
    sessionId,
    currentPhase: 0,
    briefContent,
    phase1Results: [],
    phase2Results: [],
    phase3Results: [],
    entryPhase: null,
  };
}

export function applyTurnResult(
  session: DrillSessionState,
  phase: 1 | 2 | 3,
  result: TurnResult,
): DrillSessionState {
  const updated = { ...session };
  if (phase === 1) {
    updated.phase1Results = [...session.phase1Results, result];
  } else if (phase === 2) {
    updated.phase2Results = [...session.phase2Results, result];
  } else if (phase === 3) {
    updated.phase3Results = [...session.phase3Results, result];
  }
  return updated;
}
