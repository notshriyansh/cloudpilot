import { describe, expect, it } from "vitest";

import { buildResourceGraph, createPlan, diffStates } from "../src";
import type { DesiredState, ObservedState } from "../src";

describe("createPlan", () => {
  it("creates a plan from resource creations", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(desired.resources);
    const plan = createPlan(diff, graph);

    expect(plan).toEqual({
      operations: [
        {
          action: "create",
          resource: {
            type: "zone",
            id: "zone-1",
          },
          desired: desired.resources[0],
          dependencies: [],
        },
      ],
    });
  });

  it("creates an update operation with desired and observed state", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.20",
            ttl: 300,
            proxied: true,
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
        },
      ],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(desired.resources);
    const plan = createPlan(diff, graph);

    expect(plan).toEqual({
      operations: [
        {
          action: "update",
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          desired: desired.resources[0],
          observed: observed.resources[0],
          dependencies: [],
        },
      ],
    });
  });

  it("creates a delete operation from observed state", () => {
    const desired: DesiredState = {
      resources: [],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
        },
      ],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(observed.resources);
    const plan = createPlan(diff, graph);

    expect(plan).toEqual({
      operations: [
        {
          action: "delete",
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          observed: observed.resources[0],
          dependencies: [],
        },
      ],
    });
  });

  it("includes resource dependencies in create operations", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(desired.resources);
    const plan = createPlan(diff, graph);

    expect(plan.operations).toEqual([
      {
        action: "create",
        resource: {
          type: "zone",
          id: "zone-1",
        },
        desired: desired.resources[0],
        dependencies: [],
      },
      {
        action: "create",
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        desired: desired.resources[1],
        dependencies: [
          {
            type: "zone",
            id: "zone-1",
          },
        ],
      },
    ]);
  });

  it("orders create operations by dependency", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(desired.resources);
    const plan = createPlan(diff, graph);

    expect(plan.operations.map((operation) => operation.resource)).toEqual([
      {
        type: "zone",
        id: "zone-1",
      },
      {
        type: "dns_record",
        id: "record-1",
      },
    ]);
  });

  it("orders update operations by dependency", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.20",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "pending",
          },
        },
      ],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(desired.resources);
    const plan = createPlan(diff, graph);

    expect(plan.operations.map((operation) => operation.resource)).toEqual([
      {
        type: "zone",
        id: "zone-1",
      },
      {
        type: "dns_record",
        id: "record-1",
      },
    ]);
  });

  it("orders delete operations before their dependencies", () => {
    const desired: DesiredState = {
      resources: [],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
      ],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(observed.resources);
    const plan = createPlan(diff, graph);

    expect(plan.operations.map((operation) => operation.resource)).toEqual([
      {
        type: "dns_record",
        id: "record-1",
      },
      {
        type: "zone",
        id: "zone-1",
      },
    ]);
  });

  it("produces a deterministic operation order", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    const reversedDesired: DesiredState = {
      resources: [...desired.resources].reverse(),
    };

    const observed: ObservedState = {
      resources: [],
    };

    const firstPlan = createPlan(
      diffStates(desired, observed),
      buildResourceGraph(desired.resources),
    );

    const secondPlan = createPlan(
      diffStates(reversedDesired, observed),
      buildResourceGraph(reversedDesired.resources),
    );

    expect(firstPlan).toEqual(secondPlan);
  });

  it("rejects plans with dependency cycles", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "worker-1",
          },
          attributes: {
            name: "worker-1",
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "kv_namespace",
                id: "namespace-1",
              },
            },
          ],
        },
        {
          resource: {
            type: "kv_namespace",
            id: "namespace-1",
          },
          attributes: {
            name: "namespace-1",
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "worker",
                id: "worker-1",
              },
            },
          ],
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(desired.resources);

    expect(() => createPlan(diff, graph)).toThrow(
      "Operation graph contains a dependency cycle",
    );
  });

  it("orders mixed lifecycle operations using operation dependencies", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.20",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "pending",
          },
        },
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
      ],
    };

    const diff = diffStates(desired, observed);
    const graph = buildResourceGraph(desired.resources);
    const plan = createPlan(diff, graph);

    expect(plan.operations.map((operation) => operation.action)).toEqual([
      "update",
      "update",
    ]);

    expect(plan.operations.map((operation) => operation.resource)).toEqual([
      {
        type: "zone",
        id: "zone-1",
      },
      {
        type: "dns_record",
        id: "record-1",
      },
    ]);
  });
});
