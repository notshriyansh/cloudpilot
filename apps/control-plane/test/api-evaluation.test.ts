import { describe, expect, it, vi } from "vitest";
import { createApp } from "./helpers/app";
import { DesiredState } from "@cloudpilot/domain";
import { handleRequest } from "../src/app";

describe("apiEvaluation", () => {
  it("evaluates a desired state through the evaluation service", async () => {
    const evaluate = vi.fn().mockResolvedValue({
      operations: [
        {
          operation: {
            action: "create",
            resource: {
              type: "worker",
              id: "payments-api",
            },
            dependencies: [],
          },
          policy: {
            action: "allow",
            reason: "Operation is permitted by the default policy",
          },
          risk: {
            level: "low",
            reason: "Low risk operation",
          },
          approval: {
            requirement: "none",
            reason: "Operation does not require human approval",
          },
          readiness: "ready",
        },
      ],
    });

    const app = createApp({
      evaluationService: {
        evaluate,
      },
    });

    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "payments-api",
          },
          attributes: {},
        },
      ],
    };

    const response = await handleRequest(
      new Request("http://localhost/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desired),
      }),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      operations: [
        {
          operation: {
            action: "create",
            resource: {
              type: "worker",
              id: "payments-api",
            },
            dependencies: [],
          },
          policy: {
            action: "allow",
            reason: "Operation is permitted by the default policy",
          },
          risk: {
            level: "low",
            reason: "Low risk operation",
          },
          approval: {
            requirement: "none",
            reason: "Operation does not require human approval",
          },
          readiness: "ready",
        },
      ],
    });

    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledWith(desired);
  });

  it("returns 400 for invalid JSON on /evaluate", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("http://localhost/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{invalid",
      }),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON",
    });
  });

  it("returns 400 for an invalid desired state on /evaluate", async () => {
    const evaluate = vi.fn();

    const app = createApp({
      evaluationService: {
        evaluate,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/evaluate", {
        method: "POST",
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

    expect(await response.json()).toEqual({
      error: "Invalid desired state",
      errors: [
        {
          path: "resources",
          message: "resources must be an array",
        },
      ],
    });

    expect(evaluate).not.toHaveBeenCalled();
  });
});
