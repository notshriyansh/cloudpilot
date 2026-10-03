import { describe, expect, it } from "vitest";

import type { DesiredState } from "@cloudpilot/domain";

import { createMemoryDesiredStateStore } from "../src/memory-desired-state-store";

function createDesiredState(): DesiredState {
  return {
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
          name: "api.example.com",
          type: "A",
          content: "203.0.113.10",
        },
      },
    ],
  };
}

describe("memory desired state store", () => {
  it("returns undefined when no desired state has been saved", async () => {
    const store = createMemoryDesiredStateStore();

    await expect(store.getDesiredState()).resolves.toBeUndefined();
  });

  it("saves and retrieves desired state", async () => {
    const store = createMemoryDesiredStateStore();
    const desiredState = createDesiredState();

    await store.saveDesiredState(desiredState);

    await expect(store.getDesiredState()).resolves.toEqual(desiredState);
  });

  it("replaces the existing desired state", async () => {
    const store = createMemoryDesiredStateStore();

    const firstState = createDesiredState();

    const secondState: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "example.org",
          },
          attributes: {
            name: "example.org",
          },
        },
      ],
    };

    await store.saveDesiredState(firstState);
    await store.saveDesiredState(secondState);

    await expect(store.getDesiredState()).resolves.toEqual(secondState);
  });
});
