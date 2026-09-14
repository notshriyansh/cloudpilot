import { describe, expect, it } from "vitest";

import { parseManagementResourcePath } from "../src/management-resource-path";

describe("parseManagementResourcePath", () => {
  it("parses a valid resource path", () => {
    expect(parseManagementResourcePath("worker", "fluxion-api")).toEqual({
      resource: {
        type: "worker",
        id: "fluxion-api",
      },
    });
  });

  it("rejects an unsupported resource type", () => {
    expect(parseManagementResourcePath("r2_bucket", "bucket")).toEqual({
      error: "type is not a supported resource type",
    });
  });

  it("rejects an empty resource id", () => {
    expect(parseManagementResourcePath("worker", "   ")).toEqual({
      error: "id must not be empty",
    });
  });
});
