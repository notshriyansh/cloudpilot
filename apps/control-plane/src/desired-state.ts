import {
  validateDesiredState,
  type DesiredState,
  type ValidationError,
} from "@cloudpilot/domain";

export type DesiredStateParseResult =
  | {
      state: DesiredState;
      errors: [];
    }
  | {
      state?: undefined;
      errors: ValidationError[];
    };

export function parseDesiredState(value: unknown): DesiredStateParseResult {
  const shapeErrors = validateDesiredStateShape(value);

  if (shapeErrors.length > 0) {
    return {
      errors: shapeErrors,
    };
  }

  const state = value as DesiredState;
  const errors = validateDesiredState(state);

  if (errors.length > 0) {
    return {
      errors,
    };
  }

  return {
    state,
    errors: [],
  };
}

function validateDesiredStateShape(value: unknown): ValidationError[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [
      {
        path: "",
        message: "request body must be an object",
      },
    ];
  }

  const record = value as Record<string, unknown>;

  if (!Array.isArray(record.resources)) {
    return [
      {
        path: "resources",
        message: "resources must be an array",
      },
    ];
  }

  return [];
}
