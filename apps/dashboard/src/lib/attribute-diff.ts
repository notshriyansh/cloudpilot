import { areValuesEqual } from "@cloudpilot/domain";

export type AttributeChange = {
  key: string;
  status: "added" | "changed" | "removed" | "unchanged";
  observed: unknown;
  desired: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getAttributeChanges(
  observed: Record<string, unknown>,
  desired: Record<string, unknown>,
): AttributeChange[] {
  const changes: AttributeChange[] = [];

  function compare(
    key: string,
    hasObserved: boolean,
    observedValue: unknown,
    hasDesired: boolean,
    desiredValue: unknown,
  ): void {
    if (
      hasObserved &&
      hasDesired &&
      isRecord(observedValue) &&
      isRecord(desiredValue)
    ) {
      const keys = [
        ...new Set([
          ...Object.keys(observedValue),
          ...Object.keys(desiredValue),
        ]),
      ].sort();

      if (keys.length === 0) {
        changes.push({
          key,
          status: "unchanged",
          observed: observedValue,
          desired: desiredValue,
        });
        return;
      }

      for (const childKey of keys) {
        compare(
          `${key}.${childKey}`,
          Object.hasOwn(observedValue, childKey),
          observedValue[childKey],
          Object.hasOwn(desiredValue, childKey),
          desiredValue[childKey],
        );
      }

      return;
    }

    let status: AttributeChange["status"];

    if (!hasObserved) {
      status = "added";
    } else if (!hasDesired) {
      status = "removed";
    } else if (!areValuesEqual(observedValue, desiredValue)) {
      status = "changed";
    } else {
      status = "unchanged";
    }

    changes.push({
      key,
      status,
      observed: observedValue,
      desired: desiredValue,
    });
  }

  const keys = [
    ...new Set([...Object.keys(observed), ...Object.keys(desired)]),
  ].sort();

  for (const key of keys) {
    compare(
      key,
      Object.hasOwn(observed, key),
      observed[key],
      Object.hasOwn(desired, key),
      desired[key],
    );
  }

  return changes;
}
