import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import type { App } from "./app";
import { parseDesiredState } from "./desired-state";

type McpToolResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
};

function jsonResult(value: unknown): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(message: string): McpToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function logError(phase: string, error: unknown): void {
  console.error(`disposable_update: ${phase}`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  });
}

function isValidCompatibilityDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export async function updateDisposableWorker(
  app: App,
  disposableWorkerId: string | undefined,
  input: {
    script: string;
    compatibilityDate: string;
  },
) {
  if (!disposableWorkerId?.trim()) {
    return errorResult("Disposable Worker updates are not configured.");
  }

  if (
    !input.script.trim() ||
    input.script.length > 500_000 ||
    !isValidCompatibilityDate(input.compatibilityDate)
  ) {
    return errorResult("Invalid Worker script or compatibility date.");
  }

  let scope;

  try {
    scope = await app.managementService.getScope();
  } catch (error) {
    logError("management_scope_failed", error);
    return errorResult("Unable to verify the managed-resource scope.");
  }

  const isManaged = scope.resources.some(
    (resource) =>
      resource.type === "worker" && resource.id === disposableWorkerId,
  );

  if (!isManaged) {
    return errorResult(
      "The configured disposable Worker is not registered in management scope.",
    );
  }

  const desiredState = {
    resources: [
      {
        resource: {
          type: "worker" as const,
          id: disposableWorkerId,
        },
        attributes: {
          script: input.script,
          compatibilityDate: input.compatibilityDate,
        },
      },
    ],
  };

  let evaluatedPlan;

  try {
    evaluatedPlan = await app.evaluationService.evaluate(desiredState);
  } catch (error) {
    logError("evaluation_failed", error);
    return errorResult(
      "Worker update evaluation failed. Ensure an infrastructure observation is available.",
    );
  }

  const operations = evaluatedPlan.operations;

  if (operations.length === 0) {
    console.info("disposable_update: no_operation_planned");
    return errorResult("No Worker update was planned.");
  }

  const unsupportedOperation = operations.some(
    ({ operation }) =>
      operation.action !== "update" ||
      operation.resource.type !== "worker" ||
      operation.resource.id !== disposableWorkerId,
  );

  if (unsupportedOperation) {
    console.warn("disposable_update: unsupported_operation_rejected");
    return errorResult(
      "Evaluation produced an unsupported operation. Nothing was executed.",
    );
  }

  if (
    operations.some(
      ({ policy, readiness }) =>
        policy.action === "deny" || readiness === "blocked",
    )
  ) {
    console.warn("disposable_update: policy_blocked");
    return errorResult("Worker update blocked by policy.");
  }

  if (
    operations.some(
      ({ approval, readiness }) =>
        approval.requirement === "required" ||
        readiness === "approval_required",
    )
  ) {
    console.warn("disposable_update: approval_required");
    return errorResult("Worker update requires human approval.");
  }

  const plan = {
    operations: operations.map(({ operation }) => operation),
  };

  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  console.info("disposable_update: execution_started", { executionId });

  try {
    console.info("disposable_update: running_persist_started", {
      executionId,
    });

    await app.executionStore.saveExecution({
      id: executionId,
      startedAt,
      status: "running",
    });

    console.info("disposable_update: running_persist_completed", {
      executionId,
    });

    console.info("disposable_update: execution_call_started", {
      executionId,
    });

    const summary = await app.executionService.execute(plan);

    console.info("disposable_update: execution_call_completed", {
      executionId,
      status: summary.status,
    });

    if (summary.status === "failed") {
      const completedAt = new Date().toISOString();

      console.info("disposable_update: failed_execution_persist_started", {
        executionId,
      });

      await app.executionStore.saveExecution({
        id: executionId,
        startedAt,
        completedAt,
        status: "failed",
        summary,
      });

      console.info("disposable_update: failed_execution_persist_completed", {
        executionId,
      });

      return errorResult("Worker update execution failed.");
    }

    console.info("disposable_update: verification_started", { executionId });

    const observation = await app.observationService.inspect();

    const targetResourceKeys = new Set(
      desiredState.resources.map(
        ({ resource }) => `${resource.type}:${resource.id}`,
      ),
    );

    const scopedObservedState = {
      ...observation.state,
      resources: observation.state.resources.filter(({ resource }) =>
        targetResourceKeys.has(`${resource.type}:${resource.id}`),
      ),
    };

    const verification = await app.verificationService.verify(
      desiredState,
      scopedObservedState,
    );

    console.info("disposable_update: verification_completed", {
      executionId,
      status: verification.status,
    });

    const completedAt = new Date().toISOString();

    const executionStatus =
      verification.status === "verified" ? "succeeded" : "failed";

    console.info("disposable_update: final_persist_started", {
      executionId,
      status: executionStatus,
    });

    await app.executionStore.saveExecution({
      id: executionId,
      startedAt,
      completedAt,
      status: executionStatus,
      summary,
      verification,
    });

    console.info("disposable_update: final_persist_completed", {
      executionId,
      status: executionStatus,
    });

    if (executionStatus === "failed") {
      return errorResult(
        "Worker update completed, but verification did not confirm the desired state.",
      );
    }

    return jsonResult({
      executionId,
      ...summary,
      verification,
    });
  } catch (error) {
    logError("execution_or_finalization_failed", error);

    try {
      console.info("disposable_update: failure_persist_started", {
        executionId,
      });

      await app.executionStore.saveExecution({
        id: executionId,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "failed",
      });

      console.info("disposable_update: failure_persist_completed", {
        executionId,
      });
    } catch (persistError) {
      logError("failure_persist_failed", persistError);
    }

    return errorResult("Worker update execution failed.");
  }
}

export function createCloudPilotMcpServer(
  app: App,
  disposableWorkerId?: string,
) {
  const server = new McpServer({
    name: "cloudpilot",
    version: "0.1.0",
  });

  server.registerTool(
    "inspect_infrastructure",
    {
      description:
        "Inspect the current Cloudflare infrastructure and persist a new observation. This does not modify infrastructure.",
      inputSchema: {},
    },
    async () => {
      try {
        const observation = await app.observationService.inspect();
        return jsonResult(observation);
      } catch (error) {
        console.error("MCP infrastructure inspection failed:", {
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
        });

        return errorResult("Infrastructure inspection failed.");
      }
    },
  );

  server.registerTool(
    "plan_infrastructure_change",
    {
      description:
        "Create a proposed infrastructure plan from desired state. This does not execute the plan.",
      inputSchema: {
        desiredState: z.record(z.string(), z.unknown()),
      },
    },
    async ({ desiredState }) => {
      const parsed = parseDesiredState(desiredState);

      if (!parsed.state) {
        return errorResult(
          `Invalid desired state: ${JSON.stringify(parsed.errors)}`,
        );
      }

      try {
        const plan = await app.planningService.plan(parsed.state);
        return jsonResult(plan);
      } catch (error) {
        console.error("MCP infrastructure planning failed:", {
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
        });

        return errorResult(
          "Planning failed. Ensure an infrastructure observation is available.",
        );
      }
    },
  );

  server.registerTool(
    "evaluate_infrastructure_change",
    {
      description:
        "Evaluate a proposed infrastructure change against CloudPilot's existing policy, risk, and approval rules. This does not execute the plan.",
      inputSchema: {
        desiredState: z.record(z.string(), z.unknown()),
      },
    },
    async ({ desiredState }) => {
      const parsed = parseDesiredState(desiredState);

      if (!parsed.state) {
        return errorResult(
          `Invalid desired state: ${JSON.stringify(parsed.errors)}`,
        );
      }

      try {
        const evaluatedPlan = await app.evaluationService.evaluate(
          parsed.state,
        );

        return jsonResult(evaluatedPlan);
      } catch (error) {
        console.error("MCP infrastructure evaluation failed:", {
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
        });

        return errorResult(
          "Evaluation failed. Ensure an infrastructure observation is available.",
        );
      }
    },
  );

  server.registerTool(
    "update_disposable_worker",
    {
      description:
        "Update the script on CloudPilot's explicitly configured disposable Worker. The target cannot be selected by the caller. Policy-denied or approval-required operations are not executed.",
      inputSchema: {
        script: z.string().min(1).max(500_000),
        compatibilityDate: z
          .string()
          .refine(isValidCompatibilityDate, "Must be a valid YYYY-MM-DD date"),
      },
    },
    async ({ script, compatibilityDate }) => {
      return updateDisposableWorker(app, disposableWorkerId, {
        script,
        compatibilityDate,
      });
    },
  );

  return server;
}

export function createCloudPilotMcpHandler(
  app: App,
  disposableWorkerId?: string,
) {
  return createMcpHandler(
    () => createCloudPilotMcpServer(app, disposableWorkerId),
    {
      route: "/mcp",
    },
  );
}
