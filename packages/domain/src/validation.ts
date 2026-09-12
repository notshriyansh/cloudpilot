import type { ResourceRelationship } from "./relationship";
import type { ResourceType } from "./resource";
import type { DesiredState, ResourceState } from "./state";
import { resourceIdKey } from "./state";

export interface ValidationError {
  path: string;
  message: string;
}

const RESOURCE_TYPES: readonly ResourceType[] = [
  "zone",
  "dns_record",
  "worker",
  "kv_namespace",
];

function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === "string" && RESOURCE_TYPES.includes(value as ResourceType)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateResource(
  resource: ResourceState,
  index: number,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const resourcePath = `resources[${index}]`;

  if (!isResourceType(resource.resource.type)) {
    errors.push({
      path: `${resourcePath}.resource.type`,
      message: `unsupported resource type "${String(resource.resource.type)}"`,
    });
  }

  if (
    typeof resource.resource.id !== "string" ||
    resource.resource.id.trim().length === 0
  ) {
    errors.push({
      path: `${resourcePath}.resource.id`,
      message: "resource ID must be a non-empty string",
    });
  }

  if (!isRecord(resource.attributes)) {
    errors.push({
      path: `${resourcePath}.attributes`,
      message: "attributes must be an object",
    });
  }

  if (resource.relationships !== undefined) {
    resource.relationships.forEach((relationship, relationshipIndex) => {
      errors.push(
        ...validateRelationship(
          relationship,
          `${resourcePath}.relationships[${relationshipIndex}]`,
        ),
      );
    });
  }

  return errors;
}

function validateRelationship(
  relationship: ResourceRelationship,
  path: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (relationship.type !== "belongs_to") {
    errors.push({
      path: `${path}.type`,
      message: `unsupported relationship type "${String(relationship.type)}"`,
    });
  }

  if (!isResourceType(relationship.resource.type)) {
    errors.push({
      path: `${path}.resource.type`,
      message: `unsupported resource type "${String(relationship.resource.type)}"`,
    });
  }

  if (
    typeof relationship.resource.id !== "string" ||
    relationship.resource.id.trim().length === 0
  ) {
    errors.push({
      path: `${path}.resource.id`,
      message: "resource ID must be a non-empty string",
    });
  }

  return errors;
}

export function validateDesiredState(state: DesiredState): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenResources = new Set<string>();

  state.resources.forEach((resource, index) => {
    errors.push(...validateResource(resource, index));

    const key = resourceIdKey(resource.resource);

    if (seenResources.has(key)) {
      errors.push({
        path: `resources[${index}].resource`,
        message: `duplicate resource "${key}"`,
      });
    } else {
      seenResources.add(key);
    }
  });

  return errors;
}
