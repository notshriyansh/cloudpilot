import type { ResourceId, ResourceType } from "@cloudpilot/domain";

const resourceTypes: ResourceType[] = [
  "zone",
  "dns_record",
  "worker",
  "kv_namespace",
];

export interface ParsedManagementResource {
  resource: ResourceId;
}

export interface ManagementRequestError {
  path: string;
  message: string;
}

export function parseManagementResource(input: unknown): {
  resource?: ResourceId;
  errors: ManagementRequestError[];
} {
  const errors: ManagementRequestError[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      errors: [
        {
          path: "",
          message: "request body must be an object",
        },
      ],
    };
  }

  const body = input as Record<string, unknown>;

  if (typeof body.type !== "string") {
    errors.push({
      path: "type",
      message: "type must be a string",
    });
  } else if (!resourceTypes.includes(body.type as ResourceType)) {
    errors.push({
      path: "type",
      message: "type is not a supported resource type",
    });
  }

  if (typeof body.id !== "string") {
    errors.push({
      path: "id",
      message: "id must be a string",
    });
  } else if (body.id.trim().length === 0) {
    errors.push({
      path: "id",
      message: "id must not be empty",
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    resource: {
      type: body.type as ResourceType,
      id: body.id as string,
    },
    errors: [],
  };
}
