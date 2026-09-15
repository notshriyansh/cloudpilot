import { describe, expect, it } from "vitest";
import type { PlanOperation } from "../src/plan";
import { createDefaultRiskEvaluator } from "../src/risk";
import type { EvaluationContext } from "../src/evaluation-context";

describe("default risk evaluator", () => {
  const evaluator = createDefaultRiskEvaluator();

  const context: EvaluationContext = {
    plan: {
      operations: [],
    },
  };

  it("classifies DNS record creation as low risk", () => {
    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    };

    expect(evaluator.assess(operation, context)).toEqual({
      level: "low",
      reason: "Creating a DNS record is a relatively low-risk operation",
    });
  });

  it("classifies DNS record updates as medium risk", () => {
    const operation: PlanOperation = {
      action: "update",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    };

    expect(evaluator.assess(operation, context)).toEqual({
      level: "medium",
      reason: "Updating a DNS record can affect traffic routing",
    });
  });

  it("classifies DNS record deletion as high risk", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    };

    expect(evaluator.assess(operation, context)).toEqual({
      level: "high",
      reason: "Deleting a DNS record can affect traffic routing",
    });
  });

  it("classifies zone deletion as critical risk", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "zone",
        id: "zone-1",
      },
      dependencies: [],
    };

    expect(evaluator.assess(operation, context)).toEqual({
      level: "critical",
      reason: "Deleting a zone can have a broad infrastructure impact",
    });
  });

  it("defaults worker creation to medium risk", () => {
    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    expect(evaluator.assess(operation, context)).toEqual({
      level: "medium",
      reason: "Infrastructure mutation requires moderate caution",
    });
  });

  it("defaults worker updates to medium risk", () => {
    const operation: PlanOperation = {
      action: "update",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    expect(evaluator.assess(operation, context)).toEqual({
      level: "medium",
      reason: "Infrastructure mutation requires moderate caution",
    });
  });

  it("defaults worker deletion to medium risk", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    expect(evaluator.assess(operation, context)).toEqual({
      level: "medium",
      reason: "Infrastructure mutation requires moderate caution",
    });
  });
});
