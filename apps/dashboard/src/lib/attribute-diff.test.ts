import { describe, expect, it } from "vitest";
import { getAttributeChanges } from "./attribute-diff";

describe("getAttributeChanges", () => {
  it("identifies added, changed, removed, and unchanged attributes", () => {
    const changes = getAttributeChanges(
      {
        unchanged: "same",
        changed: "old",
        removed: true,
      },
      {
        unchanged: "same",
        changed: "new",
        added: 42,
      },
    );

    expect(changes).toEqual([
      {
        key: "added",
        status: "added",
        observed: undefined,
        desired: 42,
      },
      {
        key: "changed",
        status: "changed",
        observed: "old",
        desired: "new",
      },
      {
        key: "removed",
        status: "removed",
        observed: true,
        desired: undefined,
      },
      {
        key: "unchanged",
        status: "unchanged",
        observed: "same",
        desired: "same",
      },
    ]);
  });

  it("compares nested objects and arrays by value", () => {
    const observed = {
      settings: { retries: 3, enabled: true },
      regions: ["ap-south-1", "us-east-1"],
    };

    const desired = {
      settings: { enabled: true, retries: 3 },
      regions: ["ap-south-1", "us-east-1"],
    };

    expect(
      getAttributeChanges(observed, desired).every(
        (change) => change.status === "unchanged",
      ),
    ).toBe(true);

    const modified = getAttributeChanges(observed, {
      settings: { enabled: true, retries: 4 },
      regions: ["ap-south-1", "us-east-1"],
    });

    expect(modified.find((change) => change.key === "settings")?.status).toBe(
      "changed",
    );
  });

  it("distinguishes null from missing attributes", () => {
    const changes = getAttributeChanges({ nullable: null }, { added: null });

    expect(changes.find((change) => change.key === "nullable")?.status).toBe(
      "removed",
    );

    expect(changes.find((change) => change.key === "added")?.status).toBe(
      "added",
    );
  });

  it("returns an empty list when both states have no attributes", () => {
    expect(getAttributeChanges({}, {})).toEqual([]);
  });

  it("sorts attribute keys deterministically", () => {
    expect(
      getAttributeChanges({ zebra: 1, alpha: 2 }, { beta: 3 }).map(
        (change) => change.key,
      ),
    ).toEqual(["alpha", "beta", "zebra"]);
  });
});
