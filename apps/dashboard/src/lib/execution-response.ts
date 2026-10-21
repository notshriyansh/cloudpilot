import type { ExecutionRecord } from "@cloudpilot/domain";

export type LatestExecutionResult =
  { kind: "empty" } | { kind: "ready"; execution: ExecutionRecord };

export function parseLatestExecutionResponse(
  status: number,
  body: unknown,
): LatestExecutionResult {
  if (status === 404) {
    return { kind: "empty" };
  }

  if (status < 200 || status >= 300) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Unable to load the latest execution.";

    throw new Error(message);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string" ||
    !("status" in body) ||
    !["running", "succeeded", "failed"].includes(String(body.status)) ||
    !("startedAt" in body) ||
    typeof body.startedAt !== "string"
  ) {
    throw new Error("The control plane returned an invalid execution.");
  }

  return {
    kind: "ready",
    execution: body as ExecutionRecord,
  };
}
