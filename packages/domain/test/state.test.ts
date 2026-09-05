import { describe, expect, it } from "vitest";
import type { DesiredState, ObservedState, ResourceState } from "../src/index";
import { findResource, resourceIdKey } from "../src/state";

describe("CloudPilot state model", () => {
  it("represents a resource state", () => {
    const resource: ResourceState = {
      resource: {
        type: "zone",
        id: "zone-123",
      },
      attributes: {
        name: "example.com",
        status: "active",
      },
    };

    expect(resource).toEqual({
      resource: {
        type: "zone",
        id: "zone-123",
      },
      attributes: {
        name: "example.com",
        status: "active",
      },
    });
  });

  it("represents observed state", () => {
    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-123",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    expect(observed.resources).toHaveLength(1);
  });

  it("represents desired state", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-123",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    expect(desired.resources).toHaveLength(1);
  });

  it("creates a stable resource identity key", () => {
    expect(
      resourceIdKey({
        type: "zone",
        id: "zone-123",
      }),
    ).toBe("zone:zone-123");
  });

  it("finds a resource by identity", () => {
    const state: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-123",
          },
          attributes: {
            name: "example.com",
          },
        },
      ],
    };

    expect(
      findResource(state, {
        type: "zone",
        id: "zone-123",
      }),
    ).toEqual(state.resources[0]);
  });
});
