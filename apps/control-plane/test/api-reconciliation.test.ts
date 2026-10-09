import { DesiredState } from "@cloudpilot/domain";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./helpers/app";
import { handleRequest } from "../src/app";
import { ReconciliationAlreadyRunningError } from "../src/reconciliation-service";

describe("apiReconciliation", () => {
  it("returns 200 when POST /reconcile finds desired state already in sync", async () => {
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

    const reconcile = vi.fn().mockResolvedValue({
      status: "in_sync",
      desired,
    });

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
      }),
      app,
    );

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      status: "in_sync",
      desired,
    });

    expect(reconcile).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledWith();
  });

  it("returns 403 when POST /reconcile is blocked by policy", async () => {
    const desired: DesiredState = {
      resources: [],
    };

    const reconcile = vi.fn().mockResolvedValue({
      status: "blocked",
      desired,
      plan: {
        operations: [],
      },
    });

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
      }),
      app,
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when POST /reconcile requires approval", async () => {
    const desired: DesiredState = {
      resources: [],
    };

    const reconcile = vi.fn().mockResolvedValue({
      status: "approval_required",
      desired,
      plan: {
        operations: [],
      },
    });

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
      }),
      app,
    );

    expect(response.status).toBe(409);
  });

  it("returns 409 when another reconciliation is already running", async () => {
    const reconcile = vi
      .fn()
      .mockRejectedValue(new ReconciliationAlreadyRunningError());

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
      }),
      app,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "A reconciliation is already running",
    });
    expect(reconcile).toHaveBeenCalledOnce();
  });

  it("returns 500 when reconciliation fails with an unexpected error", async () => {
    const reconcile = vi
      .fn()
      .mockRejectedValue(new Error("Reconciliation storage unavailable"));

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
      }),
      app,
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Reconciliation failed",
    });
  });
});
