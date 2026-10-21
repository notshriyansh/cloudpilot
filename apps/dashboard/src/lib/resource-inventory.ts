import type { ResourceState } from "@cloudpilot/domain";

export type InventoryResource = ResourceState;

export type InventoryResourceType = InventoryResource["resource"]["type"];

export const RESOURCE_TYPES: InventoryResourceType[] = [
  "zone",
  "dns_record",
  "worker",
  "kv_namespace",
];

const HIDDEN_ATTRIBUTE_KEY =
  /script|secret|token|password|credential|private.?key|api.?key/i;

export function getResourceDisplayName(resource: InventoryResource): string {
  const attributes = resource.attributes;

  for (const key of ["name", "hostname"]) {
    const value = attributes[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return resource.resource.id || "Unnamed resource";
}

export function filterInventoryResources(
  resources: InventoryResource[],
  query: string,
  type: InventoryResourceType | "all",
): InventoryResource[] {
  const normalizedQuery = query.trim().toLowerCase();

  return resources.filter((resource) => {
    if (type !== "all" && resource.resource.type !== type) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchable = [
      resource.resource.id,
      resource.resource.type,
      getResourceDisplayName(resource),
    ];

    return searchable.some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });
}

export function getSafeResourceAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const safeEntries = Object.entries(attributes).flatMap(([key, value]) => {
    if (HIDDEN_ATTRIBUTE_KEY.test(key)) {
      return [];
    }

    if (Array.isArray(value)) {
      return [
        [
          key,
          value.map((item) =>
            isPlainRecord(item) ? getSafeResourceAttributes(item) : item,
          ),
        ],
      ];
    }

    if (isPlainRecord(value)) {
      return [[key, getSafeResourceAttributes(value)]];
    }

    return [[key, value]];
  });

  return Object.fromEntries(safeEntries);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
