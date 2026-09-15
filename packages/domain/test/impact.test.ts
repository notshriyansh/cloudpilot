import { describe, expect, it } from "vitest";

import type { Plan, PlanOperation } from "../src";
import { analyzeImpact } from "../src/impact";

describe("analyzeImpact", () => {
  it("includes the operation resource in its impact", () => {
    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    };

    const plan: Plan = {
      operations: [operation],
    };

    expect(analyzeImpact(operation, plan)).toEqual({
      resources: [
        {
          type: "dns_record",
          id: "record-1",
        },
      ],
    });
  });

  it("includes direct dependents that are part of the plan", () => {
    const zone: PlanOperation = {
      action: "delete",
      resource: {
        type: "zone",
        id: "zone-1",
      },
      dependencies: [],
    };

    const apiRecord: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "api",
      },
      dependencies: [
        {
          type: "zone",
          id: "zone-1",
        },
      ],
    };

    const wwwRecord: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "www",
      },
      dependencies: [
        {
          type: "zone",
          id: "zone-1",
        },
      ],
    };

    const plan: Plan = {
      operations: [zone, apiRecord, wwwRecord],
    };

    expect(analyzeImpact(zone, plan)).toEqual({
      resources: [
        {
          type: "dns_record",
          id: "api",
        },
        {
          type: "dns_record",
          id: "www",
        },
        {
          type: "zone",
          id: "zone-1",
        },
      ],
    });
  });

  it("does not include unrelated resources", () => {
    const zoneA: PlanOperation = {
      action: "delete",
      resource: {
        type: "zone",
        id: "zone-a",
      },
      dependencies: [],
    };

    const recordA: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-a",
      },
      dependencies: [
        {
          type: "zone",
          id: "zone-a",
        },
      ],
    };

    const zoneB: PlanOperation = {
      action: "delete",
      resource: {
        type: "zone",
        id: "zone-b",
      },
      dependencies: [],
    };

    const recordB: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-b",
      },
      dependencies: [
        {
          type: "zone",
          id: "zone-b",
        },
      ],
    };

    const plan: Plan = {
      operations: [zoneA, recordA, zoneB, recordB],
    };

    expect(analyzeImpact(zoneA, plan)).toEqual({
      resources: [
        {
          type: "dns_record",
          id: "record-a",
        },
        {
          type: "zone",
          id: "zone-a",
        },
      ],
    });
  });

  it("returns deterministic results independent of operation order", () => {
    const zone: PlanOperation = {
      action: "delete",
      resource: {
        type: "zone",
        id: "zone-1",
      },
      dependencies: [],
    };

    const recordZ: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-z",
      },
      dependencies: [
        {
          type: "zone",
          id: "zone-1",
        },
      ],
    };

    const recordA: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-a",
      },
      dependencies: [
        {
          type: "zone",
          id: "zone-1",
        },
      ],
    };

    const first = analyzeImpact(zone, {
      operations: [zone, recordZ, recordA],
    });

    const second = analyzeImpact(zone, {
      operations: [recordA, zone, recordZ],
    });

    expect(first).toEqual(second);
  });
});
