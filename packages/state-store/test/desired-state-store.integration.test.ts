import { describe, expect, it } from "vitest";

import type { DesiredState } from "@cloudpilot/domain";

import { createD1DesiredStateStore } from "../src/d1-desired-state-store";

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
    ],
  };
}

function createMockD1Database() {
  let storedState: string | undefined;

  const db = {
    prepare() {
      return {
        bind(..._values: unknown[]) {
          return {
            async run() {
              const stateJson = _values[0];

              if (typeof stateJson !== "string") {
                throw new Error("Expected desired state JSON");
              }

              storedState = stateJson;

              return {
                success: true,
              };
            },
          };
        },

        async first<T>() {
          if (storedState === undefined) {
            return null;
          }

          return {
            state_json: storedState,
          } as T;
        },
      };
    },
  };

  return db as unknown as D1Database;
}

describe("D1 desired state store", () => {
  it("returns undefined when no desired state exists", async () => {
    const db = createMockD1Database();
    const store = createD1DesiredStateStore(db);

    await expect(store.getDesiredState()).resolves.toBeUndefined();
  });

  it("persists and retrieves desired state", async () => {
    const db = createMockD1Database();
    const store = createD1DesiredStateStore(db);
    const desiredState = createDesiredState();

    await store.saveDesiredState(desiredState);

    await expect(store.getDesiredState()).resolves.toEqual(desiredState);
  });

  it("updates the existing desired state", async () => {
    const db = createMockD1Database();
    const store = createD1DesiredStateStore(db);

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
