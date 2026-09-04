import type { CloudflareAccount } from "./account";
import type { CloudflareProviderConfig } from "./config";
import { createCloudflareApiClient } from "./api";
import { CloudflareProviderError } from "./errors";
import type { CloudflareZone } from "./zone";

export interface CloudflareProvider {
  getAccount(): Promise<CloudflareAccount>;
  listZones(): Promise<CloudflareZone[]>;
}

export function createCloudflareProvider(
  config: CloudflareProviderConfig,
  fetchImpl: typeof fetch = fetch,
): CloudflareProvider {
  const api = createCloudflareApiClient(config.apiToken, fetchImpl);

  return {
    async getAccount(): Promise<CloudflareAccount> {
      const { result } = await api.request<{
        id: string;
        name: string;
        status: string;
      }>(`/accounts/${config.accountId}`);

      if (
        typeof result.id !== "string" ||
        typeof result.name !== "string" ||
        typeof result.status !== "string"
      ) {
        throw new CloudflareProviderError(
          "Cloudflare API returned an invalid account result",
        );
      }

      return {
        id: result.id,
        name: result.name,
        status: result.status,
      };
    },

    async listZones(): Promise<CloudflareZone[]> {
      const zones: CloudflareZone[] = [];
      let page = 1;

      while (true) {
        const response = await api.request<unknown[]>(
          `/zones?account.id=${encodeURIComponent(config.accountId)}&page=${page}`,
        );

        for (const zone of response.result) {
          if (
            typeof zone !== "object" ||
            zone === null ||
            !("id" in zone) ||
            typeof zone.id !== "string" ||
            !("name" in zone) ||
            typeof zone.name !== "string" ||
            !("status" in zone) ||
            typeof zone.status !== "string" ||
            !("account" in zone) ||
            typeof zone.account !== "object" ||
            zone.account === null ||
            !("id" in zone.account) ||
            typeof zone.account.id !== "string"
          ) {
            throw new CloudflareProviderError(
              "Cloudflare API returned an invalid zone result",
            );
          }

          zones.push({
            id: zone.id,
            name: zone.name,
            status: zone.status,
            accountId: zone.account.id,
          });
        }

        if (
          response.resultInfo === undefined ||
          page >= response.resultInfo.totalPages
        ) {
          break;
        }

        page += 1;
      }

      return zones;
    },
  };
}
