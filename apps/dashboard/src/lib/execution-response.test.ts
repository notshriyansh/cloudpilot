import { describe, expect, it } from "vitest";

import type { ExecutionRecord } from "@cloudpilot/domain";
import { parseLatestExecutionResponse } from "./execution-response";

const execution: ExecutionRecord = {
  id: "execution-1",
  startedAt: "2026-10-21T10:00:00.000Z",
  completedAt: "2026-10-21T10:00:05.000Z",
  status: "succeeded",
  summary: {
    status: "succeeded",
    results: [],
    completed: 0,
    failed: 0,
    skipped: 0,
  },
  verification: {
    status: "mismatch",
    desired: { resources: [] },
    observed: { resources: [] },
    diff: { changes: [] },
  },
};

describe("parseLatestExecutionResponse", () => {
  it("treats a 404 as an empty execution state", () => {
    expect(
      parseLatestExecutionResponse(404, { error: "No execution available" }),
    ).toEqual({ kind: "empty" });
  });

  it("returns a valid execution and preserves its verification outcome", () => {
    expect(parseLatestExecutionResponse(200, execution)).toEqual({
      kind: "ready",
      execution,
    });
  });

  it("preserves execution success independently of verification mismatch", () => {
    const result = parseLatestExecutionResponse(200, execution);

    expect(result.kind).toBe("ready");

    if (result.kind === "ready") {
      expect(result.execution.status).toBe("succeeded");
      expect(result.execution.verification?.status).toBe("mismatch");
    }
  });

  it("uses the control-plane error for failed responses", () => {
    expect(() =>
      parseLatestExecutionResponse(502, {
        error: "Unable to reach the control plane.",
      }),
    ).toThrow("Unable to reach the control plane.");
  });

  it("uses a fallback for failed responses without an error message", () => {
    expect(() => parseLatestExecutionResponse(500, {})).toThrow(
      "Unable to load the latest execution.",
    );
  });

  it("rejects malformed successful responses", () => {
    expect(() =>
      parseLatestExecutionResponse(200, { id: "execution-1" }),
    ).toThrow("The control plane returned an invalid execution.");
  });
});
