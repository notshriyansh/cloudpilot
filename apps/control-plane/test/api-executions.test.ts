import { ExecutionRecord } from "@cloudpilot/domain";
import { describe, expect, it, vi } from "vitest";
import { createApp, createFakeExecutionStore } from "./helpers/app";
import { handleRequest } from "../src/app";

describe("apiExecutions", () => {
  it("returns an execution by ID", async () => {
    const execution: ExecutionRecord = {
      id: "execution-1",
      startedAt: "2026-09-29T10:00:00.000Z",
      completedAt: "2026-09-29T10:00:05.000Z",
      status: "succeeded",
      summary: {
        status: "succeeded",
        results: [],
        completed: 0,
        failed: 0,
        skipped: 0,
      },
    };

    const executionStore = createFakeExecutionStore();
    await executionStore.saveExecution(execution);

    const app = createApp({
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/execution-1"),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(execution);

    expect(await executionStore.getExecution("execution-1")).toEqual(execution);
  });

  it("returns 404 when an execution does not exist", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("http://localhost/executions/missing-execution"),
      app,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "Execution not found",
    });
  });

  it("returns the latest execution", async () => {
    const firstExecution: ExecutionRecord = {
      id: "execution-1",
      startedAt: "2026-09-29T10:00:00.000Z",
      completedAt: "2026-09-29T10:00:05.000Z",
      status: "succeeded",
      summary: {
        status: "succeeded",
        results: [],
        completed: 0,
        failed: 0,
        skipped: 0,
      },
    };

    const latestExecution: ExecutionRecord = {
      id: "execution-2",
      startedAt: "2026-09-29T11:00:00.000Z",
      completedAt: "2026-09-29T11:00:05.000Z",
      status: "failed",
      summary: {
        status: "failed",
        results: [],
        completed: 0,
        failed: 1,
        skipped: 0,
      },
    };

    const executionStore = createFakeExecutionStore();

    await executionStore.saveExecution(firstExecution);
    await executionStore.saveExecution(latestExecution);

    const app = createApp({
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/latest"),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(latestExecution);
  });

  it("returns 404 when no latest execution exists", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("http://localhost/executions/latest"),
      app,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "No execution available",
    });
  });

  it("returns 500 when execution retrieval fails", async () => {
    const getExecution = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      executionStore: {
        ...executionStore,
        getExecution,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/execution-1"),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Execution retrieval failed",
    });

    expect(getExecution).toHaveBeenCalledOnce();
    expect(getExecution).toHaveBeenCalledWith("execution-1");
  });

  it("returns 500 when latest execution retrieval fails", async () => {
    const getLatestExecution = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      executionStore: {
        ...executionStore,
        getLatestExecution,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/latest"),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Latest execution retrieval failed",
    });

    expect(getLatestExecution).toHaveBeenCalledOnce();
  });

  it("returns 400 for an invalid execution path", async () => {
    const getExecution = vi.fn();

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      executionStore: {
        ...executionStore,
        getExecution,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/"),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid execution path",
    });

    expect(getExecution).not.toHaveBeenCalled();
  });

  it("returns an in-progress execution without completedAt or summary", async () => {
    const execution: ExecutionRecord = {
      id: "execution-running",
      startedAt: "2026-09-29T12:00:00.000Z",
      status: "running",
    };

    const executionStore = createFakeExecutionStore();
    await executionStore.saveExecution(execution);

    const app = createApp({
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/execution-running"),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(execution);
  });
});
