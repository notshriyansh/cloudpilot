import type { CloudflareAccount } from "./account";
import type { CloudflareProviderConfig } from "./config";
import { createCloudflareApiClient } from "./api";
import type { CloudflareDnsRecord } from "./dns-record";
import { CloudflareProviderError } from "./errors";
import type { CloudflareZone } from "./zone";
import type { CloudflareWorker } from "./worker";

export interface CloudflareProvider {
  getAccount(): Promise<CloudflareAccount>;
  listZones(): Promise<CloudflareZone[]>;
  listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]>;
  listWorkers(): Promise<CloudflareWorker[]>;
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

    async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
      const records: CloudflareDnsRecord[] = [];
      let page = 1;

      while (true) {
        const response = await api.request<unknown[]>(
          `/zones/${encodeURIComponent(zoneId)}/dns_records?page=${page}`,
        );

        for (const record of response.result) {
          if (
            typeof record !== "object" ||
            record === null ||
            !("id" in record) ||
            typeof record.id !== "string" ||
            !("name" in record) ||
            typeof record.name !== "string" ||
            !("type" in record) ||
            typeof record.type !== "string" ||
            !("content" in record) ||
            typeof record.content !== "string" ||
            !("ttl" in record) ||
            typeof record.ttl !== "number" ||
            !("proxied" in record) ||
            typeof record.proxied !== "boolean"
          ) {
            throw new CloudflareProviderError(
              "Cloudflare API returned an invalid DNS record result",
            );
          }

          records.push({
            id: record.id,
            zoneId,
            name: record.name,
            type: record.type,
            content: record.content,
            ttl: record.ttl,
            proxied: record.proxied,
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

      return records;
    },
    async listWorkers(): Promise<CloudflareWorker[]> {
      const response = await api.request<unknown[]>(
        `/accounts/${encodeURIComponent(config.accountId)}/workers/scripts`,
      );

      return response.result.map((worker) => {
        if (
          typeof worker !== "object" ||
          worker === null ||
          !("id" in worker) ||
          typeof worker.id !== "string"
        ) {
          throw new CloudflareProviderError(
            "Cloudflare API returned an invalid Worker result",
          );
        }

        return {
          id: worker.id,
          ...("created_on" in worker && typeof worker.created_on === "string"
            ? { createdAt: worker.created_on }
            : {}),
          ...("modified_on" in worker && typeof worker.modified_on === "string"
            ? { modifiedAt: worker.modified_on }
            : {}),
          ...("compatibility_date" in worker &&
          typeof worker.compatibility_date === "string"
            ? { compatibilityDate: worker.compatibility_date }
            : {}),
        };
      });
    },
  };
}
