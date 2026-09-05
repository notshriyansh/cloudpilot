import type { CloudflareProvider } from "@cloudpilot/cloudflare-provider";
import type { ObservedState, ResourceState } from "@cloudpilot/domain";

export interface Inventory {
  inspect(): Promise<ObservedState>;
}

export function createInventory(provider: CloudflareProvider): Inventory {
  return {
    async inspect(): Promise<ObservedState> {
      const zones = await provider.listZones();
      const resources: ResourceState[] = [];

      for (const zone of zones) {
        resources.push({
          resource: {
            type: "zone",
            id: zone.id,
          },
          attributes: {
            name: zone.name,
            status: zone.status,
          },
        });

        const dnsRecords = await provider.listDnsRecords(zone.id);

        for (const record of dnsRecords) {
          resources.push({
            resource: {
              type: "dns_record",
              id: record.id,
            },
            attributes: {
              name: record.name,
              type: record.type,
              content: record.content,
              ttl: record.ttl,
              proxied: record.proxied,
            },
            relationships: [
              {
                type: "belongs_to",
                resource: {
                  type: "zone",
                  id: zone.id,
                },
              },
            ],
          });
        }
      }

      return { resources };
    },
  };
}
