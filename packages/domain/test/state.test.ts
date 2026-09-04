import { describe, expect, it } from "vitest";
import type { DesiredState, ObservedState, ResourceState } from "../src/index";

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
});
