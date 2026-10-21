import { describe, expect, it } from "vitest";
import type { ResourceState } from "@cloudpilot/domain";
import {
  filterInventoryResources,
  getResourceDisplayName,
  getSafeResourceAttributes,
} from "./resource-inventory";

function makeResource(
  type: ResourceState["resource"]["type"],
  id: string,
  attributes: Record<string, unknown> = {},
): ResourceState {
  return {
    resource: { type, id },
    attributes,
  };
}

const resources = [
  makeResource("zone", "example.com", { name: "example.com" }),
  makeResource("dns_record", "api.example.com", {
    hostname: "api.example.com",
    content: "192.0.2.10",
  }),
  makeResource("worker", "payments-api", { name: "Payments API" }),
  makeResource("kv_namespace", "CACHE", { title: "Cache namespace" }),
];

describe("resource inventory helpers", () => {
  it("uses a useful display name with an identifier fallback", () => {
    expect(getResourceDisplayName(resources[2])).toBe("Payments API");
    expect(getResourceDisplayName(resources[0])).toBe("example.com");
    expect(getResourceDisplayName(resources[3])).toBe("CACHE");
  });

  it("filters resources by type", () => {
    expect(
      filterInventoryResources(resources, "", "worker").map(
        (item) => item.resource.id,
      ),
    ).toEqual(["payments-api"]);
  });

  it("searches names, identifiers, and resource types case-insensitively", () => {
    expect(filterInventoryResources(resources, "PAYMENTS", "all")).toHaveLength(
      1,
    );

    expect(
      filterInventoryResources(resources, "dns_record", "all"),
    ).toHaveLength(1);

    expect(
      filterInventoryResources(resources, "example.com", "all"),
    ).toHaveLength(2);
  });

  it("combines search and type filters", () => {
    expect(
      filterInventoryResources(resources, "api", "dns_record").map(
        (item) => item.resource.id,
      ),
    ).toEqual(["api.example.com"]);
  });

  it("omits sensitive-looking attributes recursively", () => {
    expect(
      getSafeResourceAttributes({
        name: "Payments API",
        script: "private worker source",
        apiToken: "private token",
        config: {
          enabled: true,
          password: "private password",
        },
        bindings: [{ name: "CACHE", secretValue: "private secret" }],
      }),
    ).toEqual({
      name: "Payments API",
      config: { enabled: true },
      bindings: [{ name: "CACHE" }],
    });
  });

  it("preserves ordinary infrastructure values such as DNS content", () => {
    expect(
      getSafeResourceAttributes({
        hostname: "api.example.com",
        content: "192.0.2.10",
        proxied: true,
      }),
    ).toEqual({
      hostname: "api.example.com",
      content: "192.0.2.10",
      proxied: true,
    });
  });
});
