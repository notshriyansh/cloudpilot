import { describe, expect, it } from "vitest";

import {
  buildResourceGraph,
  ResourceGraphCycleError,
  topologicalOrder,
  buildOperationGraph,
  topologicalOrderOperations,
} from "../src";
import type { ResourceState, PlanOperation } from "../src";
import { getDependents } from "../src/graph";

describe("buildResourceGraph", () => {
  it("builds resources and belongs_to dependencies", () => {
    const resources: ResourceState[] = [
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
    ];

    const graph = buildResourceGraph(resources);

    expect(graph.resources).toEqual([
      {
        type: "zone",
        id: "zone-1",
      },
      {
        type: "dns_record",
        id: "record-1",
      },
    ]);

    expect(graph.dependencies.get("zone:zone-1")).toEqual([]);

    expect(graph.dependencies.get("dns_record:record-1")).toEqual([
      {
        type: "zone",
        id: "zone-1",
      },
    ]);
  });

  it("creates empty dependency lists for resources without relationships", () => {
    const resources: ResourceState[] = [
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
    ];

    const graph = buildResourceGraph(resources);

    expect(graph.dependencies.get("zone:zone-1")).toEqual([]);
  });

  it("preserves multiple dependencies", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        attributes: {
          name: "api.example.com",
        },
        relationships: [
          {
            type: "belongs_to",
            resource: {
              type: "zone",
              id: "zone-1",
            },
          },
          {
            type: "belongs_to",
            resource: {
              type: "zone",
              id: "zone-2",
            },
          },
        ],
      },
    ];

    const graph = buildResourceGraph(resources);

    expect(graph.dependencies.get("dns_record:record-1")).toEqual([
      {
        type: "zone",
        id: "zone-1",
      },
      {
        type: "zone",
        id: "zone-2",
      },
    ]);
  });

  it("returns an empty graph for empty resources", () => {
    const graph = buildResourceGraph([]);

    expect(graph.resources).toEqual([]);
    expect(graph.dependencies.size).toBe(0);
  });

  it("orders dependencies before dependent resources", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        attributes: {
          name: "api.example.com",
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
    ];

    const graph = buildResourceGraph(resources);

    expect(topologicalOrder(graph)).toEqual([
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

  it("handles independent resources", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "zone",
          id: "zone-1",
        },
        attributes: {
          name: "example.com",
        },
      },
      {
        resource: {
          type: "zone",
          id: "zone-2",
        },
        attributes: {
          name: "example.org",
        },
      },
    ];

    const graph = buildResourceGraph(resources);

    expect(topologicalOrder(graph)).toEqual([
      {
        type: "zone",
        id: "zone-1",
      },
      {
        type: "zone",
        id: "zone-2",
      },
    ]);
  });

  it("ignores dependencies that are not present in the graph", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        attributes: {
          name: "api.example.com",
        },
        relationships: [
          {
            type: "belongs_to",
            resource: {
              type: "zone",
              id: "zone-missing",
            },
          },
        ],
      },
    ];

    const graph = buildResourceGraph(resources);

    expect(topologicalOrder(graph)).toEqual([
      {
        type: "dns_record",
        id: "record-1",
      },
    ]);
  });

  it("rejects dependency cycles", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "zone",
          id: "zone-1",
        },
        attributes: {},
        relationships: [
          {
            type: "belongs_to",
            resource: {
              type: "zone",
              id: "zone-2",
            },
          },
        ],
      },
      {
        resource: {
          type: "zone",
          id: "zone-2",
        },
        attributes: {},
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
    ];

    const graph = buildResourceGraph(resources);

    expect(() => topologicalOrder(graph)).toThrow(ResourceGraphCycleError);
  });

  it("produces deterministic ordering independent of input order", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "worker",
          id: "worker-1",
        },
        attributes: {},
      },
      {
        resource: {
          type: "zone",
          id: "zone-2",
        },
        attributes: {},
      },
      {
        resource: {
          type: "zone",
          id: "zone-1",
        },
        attributes: {},
      },
    ];

    const reversedResources = [...resources].reverse();

    const graph = buildResourceGraph(resources);
    const reversedGraph = buildResourceGraph(reversedResources);

    expect(topologicalOrder(graph)).toEqual(topologicalOrder(reversedGraph));
  });

  it("orders create operations after their dependencies", () => {
    const operations: PlanOperation[] = [
      {
        action: "create",
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        dependencies: [
          {
            type: "zone",
            id: "zone-1",
          },
        ],
      },
      {
        action: "create",
        resource: {
          type: "zone",
          id: "zone-1",
        },
        dependencies: [],
      },
    ];

    const graph = buildOperationGraph(operations);
    const ordered = topologicalOrderOperations(graph);

    expect(ordered).toEqual([
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
    const operations: PlanOperation[] = [
      {
        action: "delete",
        resource: {
          type: "zone",
          id: "zone-1",
        },
        dependencies: [],
      },
      {
        action: "delete",
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        dependencies: [
          {
            type: "zone",
            id: "zone-1",
          },
        ],
      },
    ];

    const graph = buildOperationGraph(operations);
    const ordered = topologicalOrderOperations(graph);

    expect(ordered).toEqual([
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

  it("orders mixed lifecycle operations deterministically", () => {
    const operations: PlanOperation[] = [
      {
        action: "update",
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        dependencies: [
          {
            type: "zone",
            id: "zone-1",
          },
        ],
      },
      {
        action: "create",
        resource: {
          type: "zone",
          id: "zone-1",
        },
        dependencies: [],
      },
    ];

    const graph = buildOperationGraph(operations);
    const ordered = topologicalOrderOperations(graph);

    expect(ordered).toEqual([
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

describe("getDependents", () => {
  it("returns resources that directly depend on a resource", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "zone",
          id: "zone-1",
        },
        attributes: {
          name: "example.com",
        },
      },
      {
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        attributes: {},
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
          type: "dns_record",
          id: "record-2",
        },
        attributes: {},
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
    ];

    const graph = buildResourceGraph(resources);

    expect(
      getDependents(graph, {
        type: "zone",
        id: "zone-1",
      }),
    ).toEqual([
      {
        type: "dns_record",
        id: "record-1",
      },
      {
        type: "dns_record",
        id: "record-2",
      },
    ]);
  });

  it("returns no dependents for a resource without dependents", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "zone",
          id: "zone-1",
        },
        attributes: {},
      },
    ];

    const graph = buildResourceGraph(resources);

    expect(
      getDependents(graph, {
        type: "zone",
        id: "zone-1",
      }),
    ).toEqual([]);
  });

  it("finds dependents of a resource outside the graph", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        attributes: {},
        relationships: [
          {
            type: "belongs_to",
            resource: {
              type: "zone",
              id: "zone-missing",
            },
          },
        ],
      },
    ];

    const graph = buildResourceGraph(resources);

    expect(
      getDependents(graph, {
        type: "zone",
        id: "zone-missing",
      }),
    ).toEqual([
      {
        type: "dns_record",
        id: "record-1",
      },
    ]);
  });

  it("returns dependents in deterministic order", () => {
    const resources: ResourceState[] = [
      {
        resource: {
          type: "zone",
          id: "zone-1",
        },
        attributes: {},
      },
      {
        resource: {
          type: "dns_record",
          id: "record-z",
        },
        attributes: {},
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
          type: "dns_record",
          id: "record-a",
        },
        attributes: {},
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
    ];

    const graph = buildResourceGraph(resources);

    expect(
      getDependents(graph, {
        type: "zone",
        id: "zone-1",
      }),
    ).toEqual([
      {
        type: "dns_record",
        id: "record-a",
      },
      {
        type: "dns_record",
        id: "record-z",
      },
    ]);
  });
});
