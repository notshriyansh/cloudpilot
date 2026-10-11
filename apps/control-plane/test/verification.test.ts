import { describe, expect, it, vi } from "vitest";

import { createVerificationService } from "../src/verification";

describe("VerificationService", () => {
  it("returns verified when the deployed script matches desired state", async () => {
    const desired = {
      resources: [
        {
          resource: { type: "worker" as const, id: "payments-api" },
          attributes: {
            compatibilityDate: "2026-08-31",
            script: "worker-script",
          },
        },
      ],
    };

    const observed = {
      resources: [
        {
          resource: { type: "worker" as const, id: "payments-api" },
          attributes: { compatibilityDate: "2026-08-31" },
        },
      ],
    };

    const observationService = {
      inspect: vi.fn().mockResolvedValue({
        id: "observation-1",
        startedAt: "2026-10-01T10:00:00.000Z",
        completedAt: "2026-10-01T10:00:01.000Z",
        status: "completed",
        state: observed,
      }),
      getLatest: vi.fn(),
    };

    const readWorkerScript = vi.fn().mockResolvedValue("worker-script");
    const service = createVerificationService(
      observationService,
      readWorkerScript,
    );

    const result = await service.verify(desired);

    expect(result.status).toBe("verified");
    expect(result.observed).toEqual(observed);
    expect(result.diff).toEqual({ changes: [] });
    expect(readWorkerScript).toHaveBeenCalledWith("payments-api");
  });

  it("detects script drift even when metadata matches", async () => {
    const desired = {
      resources: [
        {
          resource: { type: "worker" as const, id: "payments-api" },
          attributes: {
            compatibilityDate: "2026-08-31",
            script: "desired-script",
          },
        },
      ],
    };

    const observed = {
      resources: [
        {
          resource: { type: "worker" as const, id: "payments-api" },
          attributes: { compatibilityDate: "2026-08-31" },
        },
      ],
    };

    const observationService = {
      inspect: vi.fn().mockResolvedValue({
        id: "observation-2",
        startedAt: "2026-10-01T10:00:00.000Z",
        completedAt: "2026-10-01T10:00:01.000Z",
        status: "completed",
        state: observed,
      }),
      getLatest: vi.fn(),
    };

    const service = createVerificationService(
      observationService,
      vi.fn().mockResolvedValue("actual-script"),
    );

    const result = await service.verify(desired);

    expect(result.status).toBe("mismatch");
    expect(result.observed).toEqual(observed);
    expect(result.diff?.changes).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("actual-script");
  });

  it("fails closed when deployed script retrieval fails", async () => {
    const desired = {
      resources: [
        {
          resource: { type: "worker" as const, id: "payments-api" },
          attributes: { script: "desired-script" },
        },
      ],
    };

    const observationService = {
      inspect: vi.fn().mockResolvedValue({
        id: "observation-3",
        startedAt: "2026-10-01T10:00:00.000Z",
        completedAt: "2026-10-01T10:00:01.000Z",
        status: "completed",
        state: {
          resources: [
            {
              resource: { type: "worker" as const, id: "payments-api" },
              attributes: {},
            },
          ],
        },
      }),
      getLatest: vi.fn(),
    };

    const service = createVerificationService(
      observationService,
      vi.fn().mockRejectedValue(new Error("Cloudflare unavailable")),
    );

    const result = await service.verify(desired);

    expect(result).toEqual({
      status: "failed",
      desired,
      error: "Cloudflare unavailable",
    });
  });

  it("returns failed when observation fails", async () => {
    const desired = {
      resources: [],
    };

    const observationService = {
      inspect: vi.fn().mockRejectedValue(new Error("Inventory unavailable")),
      getLatest: vi.fn(),
    };

    const readWorkerScript = vi.fn();

    const service = createVerificationService(
      observationService,
      readWorkerScript,
    );

    const result = await service.verify(desired);

    expect(result).toEqual({
      status: "failed",
      desired,
      error: "Inventory unavailable",
    });

    expect(observationService.inspect).toHaveBeenCalledOnce();
    expect(readWorkerScript).not.toHaveBeenCalled();
  });
});
