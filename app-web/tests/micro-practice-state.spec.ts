import { test, expect } from "@playwright/test";
import { transitionMicroPracticeState } from "../src/app/lib/learning-path/micro-practice-state";

test.describe("MicroPractice State Engine", () => {
  test("initial state transitions from idle", () => {
    // idle -> startLesson -> previewing
    const res = transitionMicroPracticeState("idle", "startLesson");
    expect(res.state).toBe("previewing");
    expect(res.progressEvent).toBe("viewed");

    // idle -> startAttempt -> practicing
    const res2 = transitionMicroPracticeState("idle", "startAttempt");
    expect(res2.state).toBe("practicing");
    expect(res2.progressEvent).toBe("attempted");
  });

  test("startAttempt moves to practicing and emits attempted", () => {
    // previewing -> startAttempt -> practicing
    const res = transitionMicroPracticeState("previewing", "startAttempt");
    expect(res.state).toBe("practicing");
    expect(res.progressEvent).toBe("attempted");
  });

  test("markAttempted moves to attempted and emits attempted", () => {
    // practicing -> markAttempted -> attempted
    const res = transitionMicroPracticeState("practicing", "markAttempted");
    expect(res.state).toBe("attempted");
    expect(res.progressEvent).toBe("attempted");
  });

  test("markRecorded moves to recorded and emits recorded", () => {
    // practicing -> markRecorded -> recorded
    const res = transitionMicroPracticeState("practicing", "markRecorded");
    expect(res.state).toBe("recorded");
    expect(res.progressEvent).toBe("recorded");
  });

  test("continueAnyway emits continued without completing", () => {
    // previewing -> continueAnyway
    const res1 = transitionMicroPracticeState("previewing", "continueAnyway");
    expect(res1.state).toBe("previewing");
    expect(res1.progressEvent).toBe("continued");

    // attempted -> continueAnyway
    const res2 = transitionMicroPracticeState("attempted", "continueAnyway");
    expect(res2.state).toBe("attempted");
    expect(res2.progressEvent).toBe("continued");

    // practicing -> continueAnyway (moves to previewing based on custom rules if desired, or stays)
    const res3 = transitionMicroPracticeState("practicing", "continueAnyway");
    expect(res3.state).toBe("previewing");
    expect(res3.progressEvent).toBe("continued");
  });

  test("completeWithSupport moves to completed and emits completed", () => {
    // recorded -> completeWithSupport -> completed
    const res = transitionMicroPracticeState("recorded", "completeWithSupport");
    expect(res.state).toBe("completed");
    expect(res.progressEvent).toBe("completed");

    // any non-completed state -> completeWithSupport -> completed
    const res2 = transitionMicroPracticeState("attempted", "completeWithSupport");
    expect(res2.state).toBe("completed");
    expect(res2.progressEvent).toBe("completed");
  });

  test("completed is terminal unless resetLocalAttempt is used", () => {
    // completed -> startAttempt -> completed (ignored)
    const res = transitionMicroPracticeState("completed", "startAttempt");
    expect(res.state).toBe("completed");
    expect(res.progressEvent).toBeNull();

    // completed -> resetLocalAttempt -> idle
    const res2 = transitionMicroPracticeState("completed", "resetLocalAttempt");
    expect(res2.state).toBe("idle");
    expect(res2.progressEvent).toBeNull();
  });

  test("resetLocalAttempt is safe", () => {
    const res = transitionMicroPracticeState("attempted", "resetLocalAttempt");
    expect(res.state).toBe("idle");
    expect(res.progressEvent).toBeNull();
  });

  test("invalid transitions are blocked or handled safely", () => {
    // idle -> markAttempted -> idle
    const res = transitionMicroPracticeState("idle", "markAttempted");
    expect(res.state).toBe("idle");
    expect(res.progressEvent).toBeNull();
  });

  test("serialized state/contract contains no private fields", () => {
    // Just a sanity check to assert that transitionMicroPracticeState
    // never returns AI scoring fields or transcripts.
    const res = transitionMicroPracticeState("practicing", "markRecorded");
    expect(Object.keys(res)).toEqual(["state", "progressEvent"]);
  });
});
