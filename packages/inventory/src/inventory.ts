import type { CloudflareProvider } from "@cloudpilot/cloudflare-provider";
import type { ObservedState, ResourceState } from "@cloudpilot/domain";

import { cloudflareDnsRecordToResource } from "./dns-record";
import { cloudflareWorkerToResource } from "./worker";
import { cloudflareZoneToResource } from "./zone";

export interface Inventory {
  inspect(): Promise<ObservedState>;
}

export function createInventory(provider: CloudflareProvider): Inventory {
  return {
    async inspect(): Promise<ObservedState> {
      const zones = await provider.listZones();
      const resources: ResourceState[] = [];

      for (const zone of zones) {
        resources.push(cloudflareZoneToResource(zone));

        const dnsRecords = await provider.listDnsRecords(zone.id);

        for (const record of dnsRecords) {
          resources.push(cloudflareDnsRecordToResource(record));
        }
      }

      const workers = await provider.listWorkers();

      for (const worker of workers) {
        const script = await provider.getWorkerScript(worker.id);

        resources.push(cloudflareWorkerToResource(worker, script));
      }

      return {
        resources,
      };
    },
  };
}
