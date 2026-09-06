import type { CloudflareDnsRecord } from "@cloudpilot/cloudflare-provider";
import type { ResourceState } from "@cloudpilot/domain";

export function cloudflareDnsRecordToResource(
  record: CloudflareDnsRecord,
): ResourceState {
  return {
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
          id: record.zoneId,
        },
      },
    ],
  };
}
