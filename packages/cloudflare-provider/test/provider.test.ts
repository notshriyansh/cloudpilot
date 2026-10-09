import { describe, expect, it, vi } from "vitest";
import {
  CloudflareProviderError,
  createCloudflareProvider,
} from "../src/index";

describe("CloudflareProvider", () => {
  it("requests account information with the expected authentication", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "account-123",
            name: "CloudPilot Test Account",
            status: "active",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    const account = await provider.getAccount();

    expect(account).toEqual({
      id: "account-123",
      name: "CloudPilot Test Account",
      status: "active",
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-123",
    );

    expect(init).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
        Accept: "application/json",
      },
    });
  });

  it("throws a provider error for an HTTP failure", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Forbidden", {
        status: 403,
      }),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.getAccount()).rejects.toMatchObject({
      name: "CloudflareProviderError",
      status: 403,
      message: "Cloudflare API returned an invalid response with status 403",
    });
  });

  it("preserves Cloudflare error information from an HTTP failure", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [
            {
              code: 10000,
              message: "Authentication error",
            },
          ],
          result: null,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.getAccount()).rejects.toMatchObject({
      name: "CloudflareProviderError",
      status: 403,
      code: 10000,
      message: "Authentication error",
    });
  });

  it("lists zones for the configured account", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: "zone-123",
              name: "example.com",
              status: "active",
              account: {
                id: "account-123",
                name: "CloudPilot Test Account",
              },
            },
            {
              id: "zone-456",
              name: "example.org",
              status: "pending",
              account: {
                id: "account-123",
                name: "CloudPilot Test Account",
              },
            },
          ],
          result_info: {
            page: 1,
            per_page: 20,
            total_pages: 1,
            total: 2,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    const zones = await provider.listZones();

    expect(zones).toEqual([
      {
        id: "zone-123",
        name: "example.com",
        status: "active",
        accountId: "account-123",
      },
      {
        id: "zone-456",
        name: "example.org",
        status: "pending",
        accountId: "account-123",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/zones?account.id=account-123&page=1",
    );

    expect(init).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
        Accept: "application/json",
      },
    });
  });

  it("lists DNS records for a zone", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: "record-1",
              name: "api.example.com",
              type: "A",
              content: "203.0.113.10",
              ttl: 300,
              proxied: true,
            },
            {
              id: "record-2",
              name: "www.example.com",
              type: "CNAME",
              content: "example.com",
              ttl: 1,
              proxied: false,
            },
          ],
          result_info: {
            page: 1,
            per_page: 100,
            total_pages: 1,
            total: 2,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchImpl,
    );

    await expect(provider.listDnsRecords("zone-123")).resolves.toEqual([
      {
        id: "record-1",
        zoneId: "zone-123",
        name: "api.example.com",
        type: "A",
        content: "203.0.113.10",
        ttl: 300,
        proxied: true,
      },
      {
        id: "record-2",
        zoneId: "zone-123",
        name: "www.example.com",
        type: "CNAME",
        content: "example.com",
        ttl: 1,
        proxied: false,
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-123/dns_records?page=1",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("lists DNS records across multiple pages", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: "record-1",
                name: "api.example.com",
                type: "A",
                content: "203.0.113.10",
                ttl: 300,
                proxied: true,
              },
            ],
            result_info: {
              page: 1,
              per_page: 1,
              total_pages: 2,
              total: 2,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: "record-2",
                name: "www.example.com",
                type: "CNAME",
                content: "example.com",
                ttl: 1,
                proxied: false,
              },
            ],
            result_info: {
              page: 2,
              per_page: 1,
              total_pages: 2,
              total: 2,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchImpl,
    );

    await expect(provider.listDnsRecords("zone-123")).resolves.toEqual([
      {
        id: "record-1",
        zoneId: "zone-123",
        name: "api.example.com",
        type: "A",
        content: "203.0.113.10",
        ttl: 300,
        proxied: true,
      },
      {
        id: "record-2",
        zoneId: "zone-123",
        name: "www.example.com",
        type: "CNAME",
        content: "example.com",
        ttl: 1,
        proxied: false,
      },
    ]);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.cloudflare.com/client/v4/zones/zone-123/dns_records?page=1",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "application/json",
        },
      },
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.cloudflare.com/client/v4/zones/zone-123/dns_records?page=2",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("rejects malformed DNS records", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: "record-1",
              name: "api.example.com",
              type: "A",
              content: "203.0.113.10",
              ttl: "300",
              proxied: true,
            },
          ],
          result_info: {
            page: 1,
            per_page: 100,
            total_pages: 1,
            total: 1,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchImpl,
    );

    await expect(provider.listDnsRecords("zone-123")).rejects.toThrow(
      "Cloudflare API returned an invalid DNS record result",
    );
  });

  it("lists zones across multiple pages", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: "zone-123",
                name: "example.com",
                status: "active",
                account: {
                  id: "account-123",
                  name: "CloudPilot Test Account",
                },
              },
            ],
            result_info: {
              page: 1,
              per_page: 1,
              total_pages: 2,
              total: 2,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: "zone-456",
                name: "example.org",
                status: "active",
                account: {
                  id: "account-123",
                  name: "CloudPilot Test Account",
                },
              },
            ],
            result_info: {
              page: 2,
              per_page: 1,
              total_pages: 2,
              total: 2,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    const zones = await provider.listZones();

    expect(zones).toEqual([
      {
        id: "zone-123",
        name: "example.com",
        status: "active",
        accountId: "account-123",
      },
      {
        id: "zone-456",
        name: "example.org",
        status: "active",
        accountId: "account-123",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/zones?account.id=account-123&page=1",
    );

    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.cloudflare.com/client/v4/zones?account.id=account-123&page=2",
    );
  });

  it("propagates an error when a later zone page fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: "zone-123",
                name: "example.com",
                status: "active",
                account: {
                  id: "account-123",
                  name: "CloudPilot Test Account",
                },
              },
            ],
            result_info: {
              page: 1,
              per_page: 1,
              total_pages: 2,
              total: 2,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            errors: [
              {
                code: 10000,
                message: "Authentication error",
              },
            ],
            result: null,
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.listZones()).rejects.toMatchObject({
      name: "CloudflareProviderError",
      status: 403,
      code: 10000,
      message: "Authentication error",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a provider error for a malformed zones response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: "zone-123",
              name: "example.com",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.listZones()).rejects.toMatchObject({
      name: "CloudflareProviderError",
      message: "Cloudflare API returned an invalid zone result",
    });
  });

  it("throws a provider error for an unsuccessful Cloudflare response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [
            {
              code: 10000,
              message: "Authentication error",
            },
          ],
          result: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.getAccount()).rejects.toBeInstanceOf(
      CloudflareProviderError,
    );
  });

  it("throws a provider error for a malformed account response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "account-123",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.getAccount()).rejects.toBeInstanceOf(
      CloudflareProviderError,
    );
  });

  it("lists Workers for the configured account", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: "api-worker",
              created_on: "2026-09-01T10:00:00.000Z",
              modified_on: "2026-09-10T12:00:00.000Z",
              compatibility_date: "2026-08-31",
            },
            {
              id: "frontend-worker",
              created_on: "2026-09-02T10:00:00.000Z",
              modified_on: "2026-09-11T12:00:00.000Z",
              compatibility_date: "2026-08-31",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.listWorkers()).resolves.toEqual([
      {
        id: "api-worker",
        createdAt: "2026-09-01T10:00:00.000Z",
        modifiedAt: "2026-09-10T12:00:00.000Z",
        compatibilityDate: "2026-08-31",
      },
      {
        id: "frontend-worker",
        createdAt: "2026-09-02T10:00:00.000Z",
        modifiedAt: "2026-09-11T12:00:00.000Z",
        compatibilityDate: "2026-08-31",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account-123/workers/scripts",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("accepts Workers without optional metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: "minimal-worker",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.listWorkers()).resolves.toEqual([
      {
        id: "minimal-worker",
      },
    ]);
  });

  it("rejects malformed Workers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: 123,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.listWorkers()).rejects.toThrow(
      "Cloudflare API returned an invalid Worker result",
    );
  });

  it("propagates Cloudflare errors when listing Workers fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [
            {
              code: 10000,
              message: "Authentication error",
            },
          ],
          result: null,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.listWorkers()).rejects.toMatchObject({
      name: "CloudflareProviderError",
      status: 403,
      code: 10000,
      message: "Authentication error",
    });
  });

  it("retrieves deployed Worker script content as raw text", async () => {
    const script = [
      "export default {",
      "  fetch() {",
      '    return new Response("hello");',
      "  },",
      "};",
    ].join("\n");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(script, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript+module",
        },
      }),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.getWorkerScript("api-worker")).resolves.toBe(script);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account-123/workers/scripts/api-worker",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "*/*",
        },
      },
    );
  });

  it("preserves Cloudflare errors when retrieving Worker script content fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [
            {
              code: 10000,
              message: "Authentication error",
            },
          ],
          result: null,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "test-token",
      },
      fetchMock,
    );

    await expect(provider.getWorkerScript("api-worker")).rejects.toMatchObject({
      name: "CloudflareProviderError",
      status: 403,
      code: 10000,
      message: "Authentication error",
    });
  });

  it("deploys a Worker using multipart module upload", async () => {
    let request: Request | undefined;

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input, init) => {
        request = new Request(input, init);

        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: "new-worker",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      });

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "token-123",
      },
      fetchImpl,
    );

    await provider.deployWorker("new-worker", {
      script: `export default {
  fetch() {
    return new Response("hello");
  },
}`,
      compatibilityDate: "2026-08-31",
    });

    expect(request?.method).toBe("PUT");

    expect(request?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-123/workers/scripts/new-worker",
    );

    const formData = await request?.formData();

    expect(formData).toBeDefined();

    const metadata = formData?.get("metadata");

    expect(metadata).toBe(
      JSON.stringify({
        main_module: "index.js",
        compatibility_date: "2026-08-31",
      }),
    );

    const script = formData?.get("index.js");

    expect(script).toBeInstanceOf(File);

    await expect((script as File).text()).resolves.toContain(
      'return new Response("hello")',
    );
  });

  it("deploys a Worker without compatibility metadata when none is provided", async () => {
    let request: Request | undefined;

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input, init) => {
        request = new Request(input, init);

        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: "new-worker",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      });

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "token-123",
      },
      fetchImpl,
    );

    await provider.deployWorker("new-worker", {
      script: "export default { fetch() { return new Response('ok'); } };",
    });

    const formData = await request?.formData();

    expect(formData?.get("metadata")).toBe(
      JSON.stringify({
        main_module: "index.js",
      }),
    );
  });

  it("propagates Worker deployment API errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [
            {
              code: 10001,
              message: "Authentication error",
            },
          ],
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "token-123",
      },
      fetchImpl,
    );

    await expect(
      provider.deployWorker("worker-1", {
        script: "export default { fetch() {} };",
      }),
    ).rejects.toMatchObject({
      message: "Authentication error",
      status: 403,
      code: 10001,
    });
  });

  it("deletes a Worker", async () => {
    let request: Request | undefined;

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input, init) => {
        request = new Request(input, init);

        return new Response(
          JSON.stringify({
            success: true,
            result: {},
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      });

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "token-123",
      },
      fetchImpl,
    );

    await provider.deleteWorker("worker-1");

    expect(request?.method).toBe("DELETE");

    expect(request?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-123/workers/scripts/worker-1",
    );
  });

  it("propagates Worker deletion API errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [
            {
              code: 10001,
              message: "Authentication error",
            },
          ],
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = createCloudflareProvider(
      {
        accountId: "account-123",
        apiToken: "token-123",
      },
      fetchImpl,
    );

    await expect(provider.deleteWorker("worker-1")).rejects.toMatchObject({
      message: "Authentication error",
      status: 403,
      code: 10001,
    });
  });
});
