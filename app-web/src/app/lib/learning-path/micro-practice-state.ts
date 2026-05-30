export type MicroPracticeState =
  | "idle"
  | "previewing"
  | "practicing"
  | "attempted"
  | "recorded"
  | "completed";

export type MicroPracticeAction =
  | "startLesson"
  | "startAttempt"
  | "markAttempted"
  | "markRecorded"
  | "continueAnyway"
  | "completeWithSupport"
  | "resetLocalAttempt";

export type MicroPracticeProgressEvent =
  | "viewed"
  | "attempted"
  | "recorded"
  | "continued"
  | "completed"
  | null;

export interface MicroPracticeTransitionResult {
  state: MicroPracticeState;
  progressEvent: MicroPracticeProgressEvent;
}

export function transitionMicroPracticeState(
  currentState: MicroPracticeState,
  action: MicroPracticeAction
): MicroPracticeTransitionResult {
  if (currentState === "completed" && action !== "resetLocalAttempt") {
    return { state: "completed", progressEvent: null };
  }

  switch (action) {
    case "startLesson":
      if (currentState === "idle") {
        return { state: "previewing", progressEvent: "viewed" };
      }
      break;

    case "startAttempt":
      if (currentState === "previewing" || currentState === "idle" || currentState === "attempted") {
        return { state: "practicing", progressEvent: "attempted" };
      }
      break;

    case "markAttempted":
      if (currentState === "practicing") {
        return { state: "attempted", progressEvent: "attempted" };
      }
      break;

    case "markRecorded":
      if (currentState === "practicing") {
        return { state: "recorded", progressEvent: "recorded" };
      }
      break;

    case "continueAnyway":
      // continueAnyway keeps current state (or moves to previewing if practicing) but emits 'continued'
      // Based on rules:
      // attempted → continueAnyway → attempted or previewing UI state + continued event
      // previewing → continueAnyway → previewing UI state + continued event
      if (currentState === "practicing") {
        return { state: "previewing", progressEvent: "continued" };
      }
      return { state: currentState, progressEvent: "continued" };

    case "completeWithSupport":
      // any non-completed state → completeWithSupport → completed + completed event
      return { state: "completed", progressEvent: "completed" };

    case "resetLocalAttempt":
      return { state: "idle", progressEvent: null };
  }

  // Fallback for invalid transitions
  return { state: currentState, progressEvent: null };
}
