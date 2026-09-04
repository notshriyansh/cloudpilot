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
