import { describe, expect, it } from "vitest";

import { cloudflareWorkerToResource } from "../src";

describe("cloudflareWorkerToResource", () => {
  it("maps a Cloudflare Worker into a CloudPilot resource", () => {
    expect(
      cloudflareWorkerToResource({
        id: "api-worker",
        createdAt: "2026-09-01T10:00:00.000Z",
        modifiedAt: "2026-09-10T12:00:00.000Z",
        compatibilityDate: "2026-08-31",
      }),
    ).toEqual({
      resource: {
        type: "worker",
        id: "api-worker",
      },
      attributes: {
        createdAt: "2026-09-01T10:00:00.000Z",
        modifiedAt: "2026-09-10T12:00:00.000Z",
        compatibilityDate: "2026-08-31",
      },
    });
  });

  it("omits optional attributes that are not present", () => {
    expect(
      cloudflareWorkerToResource({
        id: "minimal-worker",
      }),
    ).toEqual({
      resource: {
        type: "worker",
        id: "minimal-worker",
      },
      attributes: {},
    });
  });
});
