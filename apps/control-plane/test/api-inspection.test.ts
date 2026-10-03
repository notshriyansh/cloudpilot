import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "../src/app";
import { createApp, createFakeExecutionStore } from "./helpers/app";
import { Observation } from "@cloudpilot/state-store";

describe("apiInspection", () => {
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
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      executionStore,
    });

    const request = new Request("https://example.com/inspect");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(observation);
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when inspection fails", async () => {
    const inspect = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      executionStore,
    });

    const request = new Request("https://example.com/inspect");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: "Inspection failed",
    });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("returns the latest observation for GET /state", async () => {
    const observation: Observation = {
      id: "observation-1",
      startedAt: "2026-09-07T10:00:00.000Z",
      completedAt: "2026-09-07T10:00:05.000Z",
      status: "completed",
      state: {
        resources: [],
      },
    };

    const getLatest = vi.fn().mockResolvedValue(observation);
    const executionStore = createFakeExecutionStore();
    const inspect = vi.fn().mockResolvedValue(observation);

    const app = createApp({
      observationService: {
        inspect,
        getLatest,
      },
      executionStore,
    });

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(observation);
    expect(getLatest).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when no observation exists", async () => {
    const getLatest = vi.fn().mockResolvedValue(undefined);
    const executionStore = createFakeExecutionStore();
    const inspect = vi.fn();

    const app = createApp({
      observationService: {
        inspect,
        getLatest,
      },
      executionStore,
    });

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No observation available",
    });
  });

  it("returns 500 when state retrieval fails", async () => {
    const getLatest = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const inspect = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect,
        getLatest,
      },
      executionStore,
    });

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "State retrieval failed",
    });
  });
});
