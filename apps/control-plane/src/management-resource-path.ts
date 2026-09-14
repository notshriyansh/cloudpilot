import type { ResourceId, ResourceType } from "@cloudpilot/domain";

const resourceTypes: ResourceType[] = [
  "zone",
  "dns_record",
  "worker",
  "kv_namespace",
];

export function parseManagementResourcePath(
  type: string,
  id: string,
):
  | { resource: ResourceId; error?: undefined }
  | { resource?: undefined; error: string } {
  if (!resourceTypes.includes(type as ResourceType)) {
    return {
      error: "type is not a supported resource type",
    };
  }

  if (id.trim().length === 0) {
    return {
      error: "id must not be empty",
    };
  }

  return {
    resource: {
      type: type as ResourceType,
      id,
    },
  };
}
