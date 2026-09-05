export type ResourceType = "zone" | "dns_record" | "worker" | "kv_namespace";

export interface ResourceId {
  type: ResourceType;
  id: string;
}

export interface ResourceState {
  resource: ResourceId;
  attributes: Record<string, unknown>;
}
