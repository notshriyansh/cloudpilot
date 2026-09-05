import type { ResourceId } from "./resource";

export type ResourceRelationshipType = "belongs_to";

export interface ResourceRelationship {
  type: ResourceRelationshipType;
  resource: ResourceId;
}
