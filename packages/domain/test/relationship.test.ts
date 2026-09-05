import { describe, expect, it } from "vitest";
import type { ResourceRelationship } from "@cloudpilot/domain";

describe("ResourceRelationship", () => {
  it("represents a belongs_to relationship", () => {
    const relationship: ResourceRelationship = {
      type: "belongs_to",
      resource: {
        type: "zone",
        id: "zone-123",
      },
    };

    expect(relationship).toEqual({
      type: "belongs_to",
      resource: {
        type: "zone",
        id: "zone-123",
      },
    });
  });
});
