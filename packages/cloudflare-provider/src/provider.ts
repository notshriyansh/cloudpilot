import type { CloudflareAccount } from "./account";
import { CloudflareProviderError } from "./errors";
import type { CloudflareProviderConfig } from "./config";

const API_BASE_URL = "https://api.cloudflare.com/client/v4";

export interface CloudflareProvider {
  getAccount(): Promise<CloudflareAccount>;
}

export function createCloudflareProvider(
  config: CloudflareProviderConfig,
  fetchImpl: typeof fetch = fetch,
): CloudflareProvider {
  return {
    async getAccount(): Promise<CloudflareAccount> {
      const response = await fetchImpl(
        `${API_BASE_URL}/accounts/${config.accountId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new CloudflareProviderError(
          `Cloudflare API request failed with status ${response.status}`,
          response.status,
        );
      }

      const body: unknown = await response.json();

      if (
        typeof body !== "object" ||
        body === null ||
        !("success" in body) ||
        body.success !== true ||
        !("result" in body) ||
        typeof body.result !== "object" ||
        body.result === null
      ) {
        throw new CloudflareProviderError(
          "Cloudflare API returned an invalid account response",
          response.status,
        );
      }

      const result = body.result as Record<string, unknown>;

      if (
        typeof result.id !== "string" ||
        typeof result.name !== "string" ||
        typeof result.status !== "string"
      ) {
        throw new CloudflareProviderError(
          "Cloudflare API returned an invalid account result",
          response.status,
        );
      }

      return {
        id: result.id,
        name: result.name,
        status: result.status,
      };
    },
  };
}
