import { describe, expect, it, vi } from "vitest";

import { createVerificationService } from "../src/verification";

describe("VerificationService", () => {
  it("returns verified when observed state matches desired state", async () => {
    const desired = {
      resources: [
        {
          resource: {
            type: "worker" as const,
            id: "payments-api",
          },
          attributes: {
            script: "worker-script",
          },
        },
      ],
    };

    const observationService = {
      inspect: vi.fn().mockResolvedValue({
        id: "observation-1",
        startedAt: "2026-10-01T10:00:00.000Z",
        completedAt: "2026-10-01T10:00:01.000Z",
        status: "completed",
        state: desired,
      }),
      getLatest: vi.fn(),
    };

    const service = createVerificationService(observationService);

    const result = await service.verify(desired);

    expect(result.status).toBe("verified");
    expect(result.observed).toEqual(desired);
    expect(result.diff).toEqual({
      changes: [],
    });

    expect(observationService.inspect).toHaveBeenCalledOnce();
  });

  it("returns mismatch when observed state differs from desired state", async () => {
    const desired = {
      resources: [
        {
          resource: {
            type: "worker" as const,
            id: "payments-api",
          },
          attributes: {
            script: "desired-script",
          },
        },
      ],
    };

    const observed = {
      resources: [
        {
          resource: {
            type: "worker" as const,
            id: "payments-api",
          },
          attributes: {
            script: "actual-script",
          },
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

    const service = createVerificationService(observationService);

    const result = await service.verify(desired);

    expect(result.status).toBe("mismatch");
    expect(result.observed).toEqual(observed);
    expect(result.diff?.changes).toHaveLength(1);
  });

  it("returns failed when observation fails", async () => {
    const desired = {
      resources: [],
    };

    const observationService = {
      inspect: vi.fn().mockRejectedValue(new Error("Inventory unavailable")),
      getLatest: vi.fn(),
    };

    const service = createVerificationService(observationService);

    const result = await service.verify(desired);

    expect(result).toEqual({
      status: "failed",
      desired,
      error: "Inventory unavailable",
    });
  });
});
