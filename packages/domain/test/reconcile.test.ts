import { describe, expect, it } from "vitest";

import { reconcileStates, type DesiredState, type ObservedState } from "../src";

describe("reconcileStates", () => {
  it("returns the changes required to reach desired state", () => {
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

    expect(reconcileStates(desired, observed)).toEqual({
      changes: [
        {
          type: "create",
          resource: desired.resources[0],
        },
      ],
    });
  });

  it("returns no changes when state already matches", () => {
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

    expect(reconcileStates(desired, observed)).toEqual({
      changes: [],
    });
  });
});
