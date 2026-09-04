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
});
