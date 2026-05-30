import { useState, useCallback } from "react";
import {
  MicroPracticeState,
  MicroPracticeProgressEvent,
  transitionMicroPracticeState,
} from "./micro-practice-state";

export interface MicroPracticeContract {
  state: MicroPracticeState;
  lastProgressEvent: MicroPracticeProgressEvent;
  actions: {
    startLesson: () => void;
    startAttempt: () => void;
    markAttempted: () => void;
    markRecorded: () => void;
    continueAnyway: () => void;
    completeWithSupport: () => void;
    resetLocalAttempt: () => void;
  };
}

export function useMicroPractice(initialState: MicroPracticeState = "idle"): MicroPracticeContract {
  const [state, setState] = useState<MicroPracticeState>(initialState);
  const [lastProgressEvent, setLastProgressEvent] = useState<MicroPracticeProgressEvent>(null);

  const dispatch = useCallback((action: Parameters<typeof transitionMicroPracticeState>[1]) => {
    setState((current) => {
      const result = transitionMicroPracticeState(current, action);
      if (result.progressEvent) {
        setLastProgressEvent(result.progressEvent);
      }
      return result.state;
    });
  }, []);

  return {
    state,
    lastProgressEvent,
    actions: {
      startLesson: () => dispatch("startLesson"),
      startAttempt: () => dispatch("startAttempt"),
      markAttempted: () => dispatch("markAttempted"),
      markRecorded: () => dispatch("markRecorded"),
      continueAnyway: () => dispatch("continueAnyway"),
      completeWithSupport: () => dispatch("completeWithSupport"),
      resetLocalAttempt: () => dispatch("resetLocalAttempt"),
    },
  };
}
