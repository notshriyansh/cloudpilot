import { describe, expect, it, vi } from "vitest";
import type { Observation } from "@cloudpilot/state-store";
import { handleRequest, type App } from "../src/app";

describe("handleRequest", () => {
  it("returns an observation for GET /inspect", async () => {
    const observation: Observation = {
      id: "observation-1",
      startedAt: "2026-09-07T10:00:00.000Z",
      completedAt: "2026-09-07T10:00:05.000Z",
      status: "completed",
      state: {
        resources: [],
      },
    };

    const inspect = vi.fn().mockResolvedValue(observation);

    const app: App = {
      observationService: {
        inspect,
      },
    };

    const request = new Request("https://example.com/inspect");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(observation);
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for unknown routes", async () => {
    const inspect = vi.fn();

    const app: App = {
      observationService: {
        inspect,
      },
    };

    const request = new Request("https://example.com/");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(inspect).not.toHaveBeenCalled();
  });

  it("returns 404 for unsupported methods on /inspect", async () => {
    const inspect = vi.fn();

    const app: App = {
      observationService: {
        inspect,
      },
    };

    const request = new Request("https://example.com/inspect", {
      method: "POST",
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(inspect).not.toHaveBeenCalled();
  });

  it("returns 500 when inspection fails", async () => {
    const inspect = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const app: App = {
      observationService: {
        inspect,
      },
    };

    const request = new Request("https://example.com/inspect");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: "Inspection failed",
    });
    expect(inspect).toHaveBeenCalledTimes(1);
  });
});
