import type { ResourceRelationship } from "./relationship";

export function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => areValuesEqual(value, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;

  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key, index) =>
      key === rightKeys[index] &&
      areValuesEqual(leftRecord[key], rightRecord[key]),
  );
}

export function areRelationshipsEqual(
  left: ResourceRelationship[] | undefined,
  right: ResourceRelationship[] | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left === undefined || right === undefined) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  const leftKeys = left
    .map(
      (relationship) =>
        `${relationship.type}:${relationship.resource.type}:${relationship.resource.id}`,
    )
    .sort();

  const rightKeys = right
    .map(
      (relationship) =>
        `${relationship.type}:${relationship.resource.type}:${relationship.resource.id}`,
    )
    .sort();

  return leftKeys.every((key, index) => key === rightKeys[index]);
}
