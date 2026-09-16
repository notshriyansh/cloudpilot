import { describe, expect, it, vi } from "vitest";
import type { CloudflareProvider } from "@cloudpilot/cloudflare-provider";

import { createInventory } from "../src";

function createMockProvider(): CloudflareProvider {
  return {
    getAccount: vi.fn(),
    listZones: vi.fn(),
    listDnsRecords: vi.fn(),
    listWorkers: vi.fn(),
    deployWorker: vi.fn(),
    deleteWorker: vi.fn(),
  };
}

describe("inventory", () => {
  it("maps Cloudflare zones, DNS records, and Workers into observed state", async () => {
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

    vi.mocked(provider.listDnsRecords)
      .mockResolvedValueOnce([
        {
          id: "record-1",
          zoneId: "zone-1",
          name: "api.example.com",
          type: "A",
          content: "203.0.113.10",
          ttl: 300,
          proxied: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "record-2",
          zoneId: "zone-2",
          name: "api.example.org",
          type: "A",
          content: "203.0.113.20",
          ttl: 300,
          proxied: false,
        },
      ]);

    vi.mocked(provider.listWorkers).mockResolvedValue([
      {
        id: "worker-1",
        createdAt: "2026-09-01T10:00:00.000Z",
        modifiedAt: "2026-09-10T12:00:00.000Z",
        compatibilityDate: "2026-08-31",
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
            accountId: "account-1",
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
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
        {
          resource: {
            type: "zone",
            id: "zone-2",
          },
          attributes: {
            name: "example.org",
            status: "pending",
            accountId: "account-1",
          },
        },
        {
          resource: {
            type: "dns_record",
            id: "record-2",
          },
          attributes: {
            name: "api.example.org",
            type: "A",
            content: "203.0.113.20",
            ttl: 300,
            proxied: false,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-2",
              },
            },
          ],
        },
        {
          resource: {
            type: "worker",
            id: "worker-1",
          },
          attributes: {
            createdAt: "2026-09-01T10:00:00.000Z",
            modifiedAt: "2026-09-10T12:00:00.000Z",
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    });

    expect(provider.listZones).toHaveBeenCalledTimes(1);
    expect(provider.listDnsRecords).toHaveBeenNthCalledWith(1, "zone-1");
    expect(provider.listDnsRecords).toHaveBeenNthCalledWith(2, "zone-2");
    expect(provider.listWorkers).toHaveBeenCalledTimes(1);
  });

  it("returns an empty observed state when no zones or Workers exist", async () => {
    const provider = createMockProvider();

    vi.mocked(provider.listZones).mockResolvedValue([]);
    vi.mocked(provider.listWorkers).mockResolvedValue([]);

    const inventory = createInventory(provider);

    await expect(inventory.inspect()).resolves.toEqual({
      resources: [],
    });

    expect(provider.listDnsRecords).not.toHaveBeenCalled();
    expect(provider.listWorkers).toHaveBeenCalledTimes(1);
  });

  it("lists DNS records for each zone and preserves their relationships", async () => {
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
        status: "active",
        accountId: "account-1",
      },
    ]);

    vi.mocked(provider.listDnsRecords)
      .mockResolvedValueOnce([
        {
          id: "record-1",
          zoneId: "zone-1",
          name: "api.example.com",
          type: "A",
          content: "203.0.113.10",
          ttl: 300,
          proxied: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "record-2",
          zoneId: "zone-2",
          name: "api.example.org",
          type: "A",
          content: "203.0.113.20",
          ttl: 300,
          proxied: false,
        },
      ]);

    vi.mocked(provider.listWorkers).mockResolvedValue([]);

    const inventory = createInventory(provider);

    const observed = await inventory.inspect();

    expect(provider.listDnsRecords).toHaveBeenNthCalledWith(1, "zone-1");
    expect(provider.listDnsRecords).toHaveBeenNthCalledWith(2, "zone-2");

    expect(observed.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        }),
        expect.objectContaining({
          resource: {
            type: "dns_record",
            id: "record-2",
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-2",
              },
            },
          ],
        }),
      ]),
    );
  });

  it("lists and maps Workers into observed state", async () => {
    const provider = createMockProvider();

    vi.mocked(provider.listZones).mockResolvedValue([]);

    vi.mocked(provider.listWorkers).mockResolvedValue([
      {
        id: "worker-1",
        createdAt: "2026-09-01T10:00:00.000Z",
        modifiedAt: "2026-09-10T12:00:00.000Z",
        compatibilityDate: "2026-08-31",
      },
      {
        id: "worker-2",
      },
    ]);

    const inventory = createInventory(provider);

    await expect(inventory.inspect()).resolves.toEqual({
      resources: [
        {
          resource: {
            type: "worker",
            id: "worker-1",
          },
          attributes: {
            createdAt: "2026-09-01T10:00:00.000Z",
            modifiedAt: "2026-09-10T12:00:00.000Z",
            compatibilityDate: "2026-08-31",
          },
        },
        {
          resource: {
            type: "worker",
            id: "worker-2",
          },
          attributes: {},
        },
      ],
    });

    expect(provider.listWorkers).toHaveBeenCalledTimes(1);
    expect(provider.listDnsRecords).not.toHaveBeenCalled();
  });

  it("propagates provider errors", async () => {
    const provider = createMockProvider();
    const error = new Error("Cloudflare API unavailable");

    vi.mocked(provider.listZones).mockRejectedValue(error);

    const inventory = createInventory(provider);

    await expect(inventory.inspect()).rejects.toBe(error);
  });

  it("propagates DNS provider errors", async () => {
    const provider = createMockProvider();
    const error = new Error("DNS API unavailable");

    vi.mocked(provider.listZones).mockResolvedValue([
      {
        id: "zone-1",
        name: "example.com",
        status: "active",
        accountId: "account-1",
      },
    ]);

    vi.mocked(provider.listDnsRecords).mockRejectedValue(error);

    const inventory = createInventory(provider);

    await expect(inventory.inspect()).rejects.toBe(error);
  });
});
