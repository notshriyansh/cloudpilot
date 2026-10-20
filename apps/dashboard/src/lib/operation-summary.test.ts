import { describe, expect, it } from "vitest";
import type { PlanOperation, ResourceType } from "@cloudpilot/domain";
import { buildOperationSummary } from "./operation-summary";

function operation(
  action: PlanOperation["action"],
  type: ResourceType,
  id: string,
  observed?: PlanOperation["observed"],
  desired?: PlanOperation["desired"],
): PlanOperation {
  return {
    action,
    resource: { type, id },
    observed,
    desired,
    dependencies: [],
  };
}

describe("buildOperationSummary", () => {
  it.each([
    ["zone", "zone"],
    ["dns_record", "DNS record"],
    ["worker", "Worker"],
    ["kv_namespace", "KV namespace"],
  ] as const)("summarizes creation of a %s", (type, label) => {
    const summary = buildOperationSummary(
      operation("create", type, "example-resource", undefined, {
        resource: { type, id: "example-resource" },
        attributes: { name: "example", enabled: true },
      }),
    );

    expect(summary).toContain(`Create ${label} "example-resource"`);
    expect(summary).toContain("enabled");
    expect(summary).toContain("name");
  });

  it("summarizes updates using changed nested attribute paths", () => {
    const summary = buildOperationSummary(
      operation(
        "update",
        "dns_record",
        "api.example.com",
        {
          resource: { type: "dns_record", id: "api.example.com" },
          attributes: { settings: { ttl: 60, enabled: true } },
        },
        {
          resource: { type: "dns_record", id: "api.example.com" },
          attributes: { settings: { ttl: 120, enabled: true } },
        },
      ),
    );

    expect(summary).toContain('Update DNS record "api.example.com"');
    expect(summary).toContain("settings.ttl (changed)");
    expect(summary).not.toContain("settings.enabled");
  });

  it("does not expose Worker script source in the summary", () => {
    const summary = buildOperationSummary(
      operation(
        "update",
        "worker",
        "payments-api",
        {
          resource: { type: "worker", id: "payments-api" },
          attributes: { script: "old-secret-script" },
        },
        {
          resource: { type: "worker", id: "payments-api" },
          attributes: { script: "new-secret-script" },
        },
      ),
    );

    expect(summary).toContain("script (changed)");
    expect(summary).not.toContain("old-secret-script");
    expect(summary).not.toContain("new-secret-script");
  });

  it.each([
    ["zone", "zone"],
    ["dns_record", "DNS record"],
    ["worker", "Worker"],
    ["kv_namespace", "KV namespace"],
  ] as const)("summarizes deletion of a %s", (type, label) => {
    const summary = buildOperationSummary(
      operation("delete", type, "example-resource", {
        resource: { type, id: "example-resource" },
        attributes: {},
      }),
    );

    expect(summary).toContain(`Delete ${label} "example-resource"`);
  });

  it("handles missing desired attributes", () => {
    const summary = buildOperationSummary(
      operation("create", "worker", "payments-api"),
    );

    expect(summary).toContain("No desired attributes are available");
  });

  it("handles missing state during an update", () => {
    const summary = buildOperationSummary(
      operation("update", "worker", "payments-api"),
    );

    expect(summary).toContain("Complete observed and desired state details");
  });

  it("handles updates with no attribute differences", () => {
    const state = {
      resource: { type: "worker" as const, id: "payments-api" },
      attributes: { enabled: true },
    };

    expect(
      buildOperationSummary(
        operation("update", "worker", "payments-api", state, state),
      ),
    ).toContain("No attribute differences were detected");
  });
});
