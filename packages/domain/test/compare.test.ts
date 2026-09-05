import { describe, expect, it } from "vitest";

import { areValuesEqual } from "../src";

describe("areValuesEqual", () => {
  it("treats primitive values correctly", () => {
    expect(areValuesEqual("active", "active")).toBe(true);
    expect(areValuesEqual("active", "pending")).toBe(false);
    expect(areValuesEqual(1, 1)).toBe(true);
    expect(areValuesEqual(1, 2)).toBe(false);
    expect(areValuesEqual(null, null)).toBe(true);
    expect(areValuesEqual(null, undefined)).toBe(false);
  });

  it("compares arrays by value and order", () => {
    expect(areValuesEqual(["a", "b", "c"], ["a", "b", "c"])).toBe(true);

    expect(areValuesEqual(["a", "b", "c"], ["c", "b", "a"])).toBe(false);
  });

  it("compares nested objects independent of key order", () => {
    const left = {
      name: "example.com",
      settings: {
        enabled: true,
        retries: 3,
      },
    };

    const right = {
      settings: {
        retries: 3,
        enabled: true,
      },
      name: "example.com",
    };

    expect(areValuesEqual(left, right)).toBe(true);
  });

  it("detects nested value changes", () => {
    expect(
      areValuesEqual(
        {
          settings: {
            enabled: true,
            retries: 3,
          },
        },
        {
          settings: {
            enabled: true,
            retries: 4,
          },
        },
      ),
    ).toBe(false);
  });

  it("detects missing properties", () => {
    expect(
      areValuesEqual(
        {
          name: "example.com",
        },
        {
          name: "example.com",
          status: "active",
        },
      ),
    ).toBe(false);
  });
});
