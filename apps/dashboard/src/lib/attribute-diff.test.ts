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

  it("reports nested field-level changes using dotted paths", () => {
    const changes = getAttributeChanges(
      {
        settings: { retries: 3, enabled: true, legacy: "old" },
        regions: ["ap-south-1", "us-east-1"],
      },
      {
        settings: { retries: 4, enabled: true, timeout: 30 },
        regions: ["ap-south-1", "us-east-1"],
      },
    );

    expect(changes).toEqual([
      {
        key: "regions",
        status: "unchanged",
        observed: ["ap-south-1", "us-east-1"],
        desired: ["ap-south-1", "us-east-1"],
      },
      {
        key: "settings.enabled",
        status: "unchanged",
        observed: true,
        desired: true,
      },
      {
        key: "settings.legacy",
        status: "removed",
        observed: "old",
        desired: undefined,
      },
      {
        key: "settings.retries",
        status: "changed",
        observed: 3,
        desired: 4,
      },
      {
        key: "settings.timeout",
        status: "added",
        observed: undefined,
        desired: 30,
      },
    ]);
  });

  it("handles nested empty objects, nulls, and arrays atomically", () => {
    const changes = getAttributeChanges(
      {
        settings: {},
        nullable: null,
        rules: [{ enabled: true }],
      },
      {
        settings: {},
        nullable: null,
        rules: [{ enabled: false }],
      },
    );

    expect(changes).toEqual([
      {
        key: "nullable",
        status: "unchanged",
        observed: null,
        desired: null,
      },
      {
        key: "rules",
        status: "changed",
        observed: [{ enabled: true }],
        desired: [{ enabled: false }],
      },
      {
        key: "settings",
        status: "unchanged",
        observed: {},
        desired: {},
      },
    ]);
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
