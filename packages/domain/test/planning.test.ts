import { describe, expect, it } from "vitest";
import { createPlanFromStates } from "../src/planning";
import type { DesiredState, ObservedState } from "../src/state";

describe("createPlanFromStates", () => {
  it("creates a plan for a missing resource", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    expect(createPlanFromStates(desired, observed)).toEqual({
      operations: [
        {
          action: "create",
          resource: {
            type: "worker",
            id: "api",
          },
          desired: desired.resources[0],
          dependencies: [],
        },
      ],
    });
  });

  it("creates an update operation when observed state differs", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-25",
          },
        },
      ],
    };

    expect(createPlanFromStates(desired, observed)).toEqual({
      operations: [
        {
          action: "update",
          resource: {
            type: "worker",
            id: "api",
          },
          desired: desired.resources[0],
          observed: observed.resources[0],
          dependencies: [],
        },
      ],
    });
  });

  it("creates a delete operation using observed dependencies", () => {
    const desired: DesiredState = {
      resources: [],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "example.com",
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
          attributes: {
            name: "www.example.com",
            type: "A",
            content: "192.0.2.1",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "example.com",
              },
            },
          ],
        },
      ],
    };

    expect(createPlanFromStates(desired, observed)).toEqual({
      operations: [
        {
          action: "delete",
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          observed: observed.resources[1],
          dependencies: [
            {
              type: "zone",
              id: "example.com",
            },
          ],
        },
        {
          action: "delete",
          resource: {
            type: "zone",
            id: "example.com",
          },
          observed: observed.resources[0],
          dependencies: [],
        },
      ],
    });
  });

  it("orders dependent resources after their dependencies when creating", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "www.example.com",
            type: "A",
            content: "192.0.2.1",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "example.com",
              },
            },
          ],
        },
        {
          resource: {
            type: "zone",
            id: "example.com",
          },
          attributes: {
            name: "example.com",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    const plan = createPlanFromStates(desired, observed);

    expect(plan.operations.map((operation) => operation.resource)).toEqual([
      {
        type: "zone",
        id: "example.com",
      },
      {
        type: "dns_record",
        id: "record-1",
      },
    ]);
  });

  it("returns an empty plan when desired and observed state match", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    expect(createPlanFromStates(state, state)).toEqual({
      operations: [],
    });
  });
});
