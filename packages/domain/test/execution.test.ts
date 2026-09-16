import { describe, expect, it } from "vitest";

import type { ExecutionReport, ExecutionResult, PlanOperation } from "../src";

describe("execution", () => {
  it("represents a successful execution", () => {
    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    const result: ExecutionResult = {
      operation,
      status: "succeeded",
    };

    expect(result).toEqual({
      operation,
      status: "succeeded",
    });
  });

  it("represents a failed execution", () => {
    const operation: PlanOperation = {
      action: "update",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    const result: ExecutionResult = {
      operation,
      status: "failed",
      error: "Provider request failed",
    };

    expect(result).toEqual({
      operation,
      status: "failed",
      error: "Provider request failed",
    });
  });

  it("represents a skipped execution", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    const result: ExecutionResult = {
      operation,
      status: "skipped",
    };

    expect(result).toEqual({
      operation,
      status: "skipped",
    });
  });

  it("represents an execution report", () => {
    const report: ExecutionReport = {
      results: [],
    };

    expect(report).toEqual({
      results: [],
    });
  });

  it("preserves multiple execution results in order", () => {
    const firstOperation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    const secondOperation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "worker-2",
      },
      dependencies: [],
    };

    const report: ExecutionReport = {
      results: [
        {
          operation: firstOperation,
          status: "succeeded",
        },
        {
          operation: secondOperation,
          status: "failed",
          error: "Provider request failed",
        },
      ],
    };

    expect(report.results).toHaveLength(2);
    expect(report.results[0]).toEqual({
      operation: firstOperation,
      status: "succeeded",
    });
    expect(report.results[1]).toEqual({
      operation: secondOperation,
      status: "failed",
      error: "Provider request failed",
    });
  });
});
