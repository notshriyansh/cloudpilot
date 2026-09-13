import { describe, expect, it, vi } from "vitest";
import type { Observation } from "@cloudpilot/state-store";
import { handleRequest, type App } from "../src/app";
import type { DesiredState, Plan } from "@cloudpilot/domain";
import { NoObservationError } from "../src/planning";

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
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
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
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
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
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
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
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest,
      },
      planningService: {
        plan: vi.fn(),
      },
    };

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(observation);
    expect(getLatest).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when no observation exists", async () => {
    const getLatest = vi.fn().mockResolvedValue(undefined);

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest,
      },
      planningService: {
        plan: vi.fn(),
      },
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest,
      },
      planningService: {
        plan: vi.fn(),
      },
    };

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "State retrieval failed",
    });
  });

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
    };

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
