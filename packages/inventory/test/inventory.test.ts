import { describe, expect, it, vi } from "vitest";
import type { CloudflareProvider } from "@cloudpilot/cloudflare-provider";

import { createInventory } from "../src";

function createMockProvider(): CloudflareProvider {
  return {
    getAccount: vi.fn(),
    listZones: vi.fn(),
  };
}

describe("inventory", () => {
  it("maps Cloudflare zones into observed state", async () => {
    const provider = createMockProvider();

    vi.mocked(provider.listZones).mockResolvedValue([
      {
        id: "zone-1",
        name: "example.com",
        status: "active",
        accountId: "account-1",
      },
      {
        id: "zone-2",
        name: "example.org",
        status: "pending",
        accountId: "account-1",
      },
    ]);

    const inventory = createInventory(provider);

    await expect(inventory.inspect()).resolves.toEqual({
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
        {
          resource: {
            type: "zone",
            id: "zone-2",
          },
          attributes: {
            name: "example.org",
            status: "pending",
          },
        },
      ],
    });

    expect(provider.listZones).toHaveBeenCalledTimes(1);
  });

  it("returns an empty observed state when no zones exist", async () => {
    const provider = createMockProvider();

    vi.mocked(provider.listZones).mockResolvedValue([]);

    const inventory = createInventory(provider);

    await expect(inventory.inspect()).resolves.toEqual({
      resources: [],
    });
  });

  it("propagates provider errors", async () => {
    const provider = createMockProvider();
    const error = new Error("Cloudflare API unavailable");

    vi.mocked(provider.listZones).mockRejectedValue(error);

    const inventory = createInventory(provider);

    await expect(inventory.inspect()).rejects.toBe(error);
  });
});
