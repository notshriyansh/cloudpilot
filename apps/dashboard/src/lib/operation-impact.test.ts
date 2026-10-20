import { describe, expect, it } from "vitest";
import type { EvaluatedOperation } from "@/lib/desired-state";
import { buildOperationImpact } from "./operation-impact";

function makeOperation(
  type: "zone" | "dns_record" | "worker" | "kv_namespace",
  id: string,
  dependencies: EvaluatedOperation["operation"]["dependencies"] = [],
  action: EvaluatedOperation["operation"]["action"] = "update",
): EvaluatedOperation {
  return {
    operation: {
      action,
      resource: { type, id },
      dependencies,
    },
    policy: { action: "allow", reason: "Test policy" },
    risk: { level: "low", reason: "Test risk" },
    approval: { requirement: "none", reason: "No approval required" },
    readiness: "ready",
  };
}

describe("buildOperationImpact", () => {
  it("reports prerequisites and the planner position", () => {
    const zone = makeOperation("zone", "example.com", [], "create");
    const record = makeOperation(
      "dns_record",
      "www",
      [{ type: "zone", id: "example.com" }],
      "create",
    );

    expect(buildOperationImpact(record, [zone, record])).toMatchObject({
      prerequisites: [
        {
          index: 0,
          action: "create",
          resource: { type: "zone", id: "example.com" },
        },
      ],
      unresolvedDependencies: [],
      position: 2,
      totalOperations: 2,
    });
  });

  it("marks dependencies without a planned operation as unresolved", () => {
    const record = makeOperation("dns_record", "www", [
      { type: "zone", id: "example.com" },
    ]);

    expect(
      buildOperationImpact(record, [record]).unresolvedDependencies,
    ).toEqual([{ type: "zone", id: "example.com" }]);
  });

  it("finds multiple direct downstream operations", () => {
    const zone = makeOperation("zone", "example.com");
    const www = makeOperation("dns_record", "www", [
      { type: "zone", id: "example.com" },
    ]);
    const api = makeOperation("dns_record", "api", [
      { type: "zone", id: "example.com" },
    ]);

    expect(
      buildOperationImpact(zone, [zone, www, api]).downstreamOperations,
    ).toMatchObject([
      { index: 1, resource: { type: "dns_record", id: "www" } },
      { index: 2, resource: { type: "dns_record", id: "api" } },
    ]);
  });

  it("does not label transitive dependents as direct dependents", () => {
    const zone = makeOperation("zone", "example.com");
    const worker = makeOperation("worker", "edge", [
      { type: "zone", id: "example.com" },
    ]);
    const namespace = makeOperation("kv_namespace", "cache", [
      { type: "worker", id: "edge" },
    ]);

    expect(
      buildOperationImpact(zone, [zone, worker, namespace])
        .downstreamOperations,
    ).toMatchObject([{ resource: { type: "worker", id: "edge" } }]);
  });

  it("handles an empty operation list", () => {
    const record = makeOperation("dns_record", "www");

    expect(buildOperationImpact(record, [])).toMatchObject({
      prerequisites: [],
      unresolvedDependencies: [],
      downstreamOperations: [],
      position: 0,
      totalOperations: 0,
    });
  });

  it("places dependent deletions before their parent resource deletion", () => {
    const record = makeOperation(
      "dns_record",
      "www",
      [{ type: "zone", id: "example.com" }],
      "delete",
    );

    const zone = makeOperation("zone", "example.com", [], "delete");
    const operations = [record, zone];

    const impact = buildOperationImpact(zone, operations);

    expect(impact.position).toBe(2);
    expect(impact.downstreamOperations).toMatchObject([
      {
        index: 0,
        action: "delete",
        resource: { type: "dns_record", id: "www" },
        relationship: "before",
      },
    ]);
  });
});
