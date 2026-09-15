import { describe, expect, it } from "vitest";
import type { PlanOperation } from "../src/plan";
import { createDefaultPolicy } from "../src/policy";

describe("default policy", () => {
  const policy = createDefaultPolicy();

  it("allows creating a DNS record", () => {
    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    };

    expect(policy.evaluate(operation)).toEqual({
      action: "allow",
      reason: "Operation is permitted by the default policy",
    });
  });

  it("allows updating a DNS record", () => {
    const operation: PlanOperation = {
      action: "update",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    };

    expect(policy.evaluate(operation)).toEqual({
      action: "allow",
      reason: "Operation is permitted by the default policy",
    });
  });

  it("allows deleting a DNS record", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    };

    expect(policy.evaluate(operation)).toEqual({
      action: "allow",
      reason: "Operation is permitted by the default policy",
    });
  });

  it("allows deleting a worker", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "worker",
        id: "worker-1",
      },
      dependencies: [],
    };

    expect(policy.evaluate(operation)).toEqual({
      action: "allow",
      reason: "Operation is permitted by the default policy",
    });
  });

  it("denies deleting a zone", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "zone",
        id: "zone-1",
      },
      dependencies: [],
    };

    expect(policy.evaluate(operation)).toEqual({
      action: "deny",
      reason: "Deleting zones is not permitted by the default policy",
    });
  });
});
