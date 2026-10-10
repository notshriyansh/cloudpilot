import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import type { App } from "./app";
import { parseDesiredState } from "./desired-state";

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function createCloudPilotMcpServer(app: App) {
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
      } catch {
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
      } catch {
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
      } catch {
        return errorResult(
          "Evaluation failed. Ensure an infrastructure observation is available.",
        );
      }
    },
  );

  return server;
}

export function createCloudPilotMcpHandler(app: App) {
  return createMcpHandler(() => createCloudPilotMcpServer(app), {
    route: "/mcp",
  });
}
