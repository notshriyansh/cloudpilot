import { areValuesEqual } from "@cloudpilot/domain";

export type AttributeChange = {
  key: string;
  status: "added" | "changed" | "removed" | "unchanged";
  observed: unknown;
  desired: unknown;
};

export function getAttributeChanges(
  observed: Record<string, unknown>,
  desired: Record<string, unknown>,
): AttributeChange[] {
  const keys = [
    ...new Set([...Object.keys(observed), ...Object.keys(desired)]),
  ].sort();

  return keys.map((key) => {
    const hasObserved = Object.hasOwn(observed, key);
    const hasDesired = Object.hasOwn(desired, key);

    let status: AttributeChange["status"];

    if (!hasObserved) {
      status = "added";
    } else if (!hasDesired) {
      status = "removed";
    } else if (!areValuesEqual(observed[key], desired[key])) {
      status = "changed";
    } else {
      status = "unchanged";
    }

    return {
      key,
      status,
      observed: observed[key],
      desired: desired[key],
    };
  });
}
