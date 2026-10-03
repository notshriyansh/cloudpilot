import { DesiredState, Plan } from "@cloudpilot/domain";
import { describe, expect, it, vi } from "vitest";
import { createApp, createFakeExecutionStore } from "./helpers/app";
import { handleRequest } from "../src/app";
import { NoObservationError } from "../src/planning";

describe("apiPlanning", () => {
  it("returns a plan for POST /plan", async () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "payments-api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    const plan: Plan = {
      operations: [
        {
          action: "create",
          resource: {
            type: "worker",
            id: "payments-api",
          },
          desired: desired.resources[0],
          dependencies: [],
        },
      ],
    };

    const planning = vi.fn().mockResolvedValue(plan);
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(desired),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(plan);
    expect(planning).toHaveBeenCalledTimes(1);
    expect(planning).toHaveBeenCalledWith(desired);
  });

  it("returns 400 for invalid JSON on POST /plan", async () => {
    const planning = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{invalid json",
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON",
    });
    expect(planning).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid desired state", async () => {
    const planning = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resources: "not-an-array",
      }),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid desired state",
      errors: [
        {
          path: "resources",
          message: "resources must be an array",
        },
      ],
    });
    expect(planning).not.toHaveBeenCalled();
  });

  it("returns 404 when planning has no observation", async () => {
    const planning = vi.fn().mockRejectedValue(new NoObservationError());
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resources: [],
      }),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No observation available",
    });
  });

  it("returns 500 when planning fails", async () => {
    const planning = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resources: [],
      }),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Planning failed",
    });
  });
});
