import { describe, expect, it, vi } from "vitest";
import { createApp, desiredState } from "./helpers/app";
import { handleRequest } from "../src/app";
import { createMemoryDesiredStateStore } from "@cloudpilot/state-store";

describe("apiDesiredState", () => {
  it("returns 404 when no desired state is configured", async () => {
    const app = createApp({
      desiredStateStore: {
        getDesiredState: vi.fn().mockResolvedValue(undefined),
        saveDesiredState: vi.fn(),
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/desired-state"),
      app,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "No desired state configured",
    });
  });

  it("stores and returns a valid desired state", async () => {
    const saveDesiredState = vi.fn().mockResolvedValue(undefined);

    const app = createApp({
      desiredStateStore: {
        getDesiredState: vi.fn(),
        saveDesiredState,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/desired-state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desiredState),
      }),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(desiredState);

    expect(saveDesiredState).toHaveBeenCalledTimes(1);
    expect(saveDesiredState).toHaveBeenCalledWith(desiredState);
  });

  it("returns 400 for invalid JSON when updating desired state", async () => {
    const saveDesiredState = vi.fn();

    const app = createApp({
      desiredStateStore: {
        getDesiredState: vi.fn(),
        saveDesiredState,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/desired-state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: "{invalid-json",
      }),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON",
    });

    expect(saveDesiredState).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid desired state", async () => {
    const saveDesiredState = vi.fn();

    const app = createApp({
      desiredStateStore: {
        getDesiredState: vi.fn(),
        saveDesiredState,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/desired-state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resources: "not-an-array",
        }),
      }),
      app,
    );

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: string;
      errors: unknown[];
    };

    expect(body.error).toBe("Invalid desired state");
    expect(body.errors.length).toBeGreaterThan(0);

    expect(saveDesiredState).not.toHaveBeenCalled();
  });

  it("returns the configured desired state", async () => {
    const app = createApp({
      desiredStateStore: {
        getDesiredState: vi.fn().mockResolvedValue(desiredState),
        saveDesiredState: vi.fn(),
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/desired-state"),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(desiredState);
  });

  it("returns 500 when desired state retrieval fails", async () => {
    const app = createApp({
      desiredStateStore: {
        getDesiredState: vi.fn().mockRejectedValue(new Error("D1 unavailable")),
        saveDesiredState: vi.fn(),
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/desired-state"),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Desired state retrieval failed",
    });
  });

  it("returns 500 when desired state update fails", async () => {
    const app = createApp({
      desiredStateStore: {
        getDesiredState: vi.fn(),
        saveDesiredState: vi
          .fn()
          .mockRejectedValue(new Error("D1 unavailable")),
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/desired-state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desiredState),
      }),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Desired state update failed",
    });
  });

  it("persists desired state across PUT and GET", async () => {
    const desiredStateStore = createMemoryDesiredStateStore();

    const app = createApp({
      desiredStateStore,
    });

    const putResponse = await handleRequest(
      new Request("http://localhost/desired-state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desiredState),
      }),
      app,
    );

    expect(putResponse.status).toBe(200);

    const getResponse = await handleRequest(
      new Request("http://localhost/desired-state"),
      app,
    );

    expect(getResponse.status).toBe(200);

    await expect(getResponse.json()).resolves.toEqual(desiredState);
  });
});
