import {
  createCloudflareOperationExecutor,
  createCloudflareProvider,
} from "@cloudpilot/cloudflare-provider";
import { createInventory, type Inventory } from "@cloudpilot/inventory";
import {
  createObservationService,
  type Clock,
  type IdGenerator,
  type ObservationService,
} from "./observation";
import {
  createPlanningService,
  NoObservationError,
  type PlanningService,
} from "./planning";
import { parseDesiredState } from "./desired-state";
import {
  createD1ManagementScopeStore,
  createD1ExecutionStore,
  createD1StateStore,
  type ManagementScopeStore,
  type StateStore,
  ExecutionStore,
} from "@cloudpilot/state-store";
import { createManagementService, type ManagementService } from "./management";
import { parseManagementResource } from "./management-request";
import { parseManagementResourcePath } from "./management-resource-path";
import { createExecutionService, type ExecutionService } from "./execution";
import {
  createDefaultApprovalEvaluator,
  createDefaultPolicy,
  createDefaultRiskEvaluator,
  createPlanEvaluator,
  type OperationExecutor,
  type PlanEvaluator,
} from "@cloudpilot/domain";
import { createEvaluationService, EvaluationService } from "./evaluation";
import {
  createVerificationService,
  type VerificationService,
} from "./verification";

export interface App {
  observationService: ObservationService;
  planningService: PlanningService;
  managementService: ManagementService;
  executionService: ExecutionService;
  verificationService: VerificationService;
  executionStore: ExecutionStore;
  planEvaluator: PlanEvaluator;
  evaluationService: EvaluationService;
}

export interface AppDependencies {
  inventory: Inventory;
  stateStore: StateStore;
  executionStore: ExecutionStore;
  clock: Clock;
  idGenerator: IdGenerator;
  managementScopeStore: ManagementScopeStore;
  operationExecutor: OperationExecutor;
}

export function createApp(dependencies: AppDependencies): App {
  const observationService = createObservationService(
    dependencies.inventory,
    dependencies.stateStore,
    dependencies.clock,
    dependencies.idGenerator,
  );

  const planningService = createPlanningService(
    dependencies.stateStore,
    dependencies.managementScopeStore,
  );

  const managementService = createManagementService(
    dependencies.managementScopeStore,
  );

  const executionService = createExecutionService(
    dependencies.operationExecutor,
  );

  const planEvaluator = createPlanEvaluator(
    createDefaultPolicy(),
    createDefaultRiskEvaluator(),
    createDefaultApprovalEvaluator(),
  );

  const evaluationService = createEvaluationService(
    planningService,
    planEvaluator,
  );

  const verificationService = createVerificationService(observationService);

  return {
    observationService,
    planningService,
    managementService,
    executionService,
    verificationService,
    executionStore: dependencies.executionStore,
    planEvaluator,
    evaluationService,
  };
}

export function createProductionApp(env: Env) {
  const provider = createCloudflareProvider({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
  });

  const operationExecutor = createCloudflareOperationExecutor(provider);

  const inventory = createInventory(provider);
  const stateStore = createD1StateStore(env.cloudpilot);
  const executionStore = createD1ExecutionStore(env.cloudpilot);

  const managementScopeStore = createD1ManagementScopeStore(env.cloudpilot);

  return createApp({
    inventory,
    stateStore,
    executionStore,
    clock: {
      now: () => new Date(),
    },
    idGenerator: {
      generate: () => crypto.randomUUID(),
    },
    managementScopeStore,
    operationExecutor,
  });
}

export async function handleRequest(
  request: Request,
  app: App,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/inspect") {
    try {
      const observation = await app.observationService.inspect();

      return Response.json(observation);
    } catch (error) {
      console.error("Inspection failed", error);

      return Response.json(
        {
          error: "Inspection failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/state") {
    try {
      const observation = await app.observationService.getLatest();

      if (observation === undefined) {
        return Response.json(
          {
            error: "No observation available",
          },
          {
            status: 404,
          },
        );
      }

      return Response.json(observation);
    } catch (error) {
      console.error("State retrieval failed", error);

      return Response.json(
        {
          error: "State retrieval failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/managed-resources") {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: "Invalid JSON",
        },
        {
          status: 400,
        },
      );
    }

    const result = parseManagementResource(body);

    if (result.errors.length > 0) {
      return Response.json(
        {
          error: "Invalid managed resource",
          errors: result.errors,
        },
        {
          status: 400,
        },
      );
    }

    try {
      await app.managementService.register(result.resource!);

      return Response.json(
        {
          resource: result.resource,
        },
        {
          status: 201,
        },
      );
    } catch (error) {
      console.error("Management resource registration failed", error);

      return Response.json(
        {
          error: "Management resource registration failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (
    request.method === "DELETE" &&
    url.pathname.startsWith("/managed-resources/")
  ) {
    const parts = url.pathname.split("/");

    if (parts.length !== 4 || parts[2] === "" || parts[3] === "") {
      return Response.json(
        {
          error: "Invalid managed resource path",
        },
        {
          status: 400,
        },
      );
    }

    const type = decodeURIComponent(parts[2]);
    const id = decodeURIComponent(parts[3]);

    const result = parseManagementResourcePath(type, id);

    if (result.error !== undefined) {
      return Response.json(
        {
          error: "Invalid managed resource",
          errors: [
            {
              path: "resource",
              message: result.error,
            },
          ],
        },
        {
          status: 400,
        },
      );
    }

    try {
      await app.managementService.unregister(result.resource);

      return new Response(null, {
        status: 204,
      });
    } catch (error) {
      console.error("Management resource unregistration failed", error);

      return Response.json(
        {
          error: "Management resource unregistration failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/managed-resources") {
    try {
      const scope = await app.managementService.getScope();

      return Response.json(scope);
    } catch (error) {
      console.error("Management scope retrieval failed", error);

      return Response.json(
        {
          error: "Management scope retrieval failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/executions/latest") {
    try {
      const execution = await app.executionStore.getLatestExecution();

      if (execution === undefined) {
        return Response.json(
          {
            error: "No execution available",
          },
          {
            status: 404,
          },
        );
      }

      return Response.json(execution);
    } catch (error) {
      console.error("Latest execution retrieval failed", error);

      return Response.json(
        {
          error: "Latest execution retrieval failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/executions/")) {
    const parts = url.pathname.split("/");

    if (parts.length !== 3 || parts[2] === "") {
      return Response.json(
        {
          error: "Invalid execution path",
        },
        {
          status: 400,
        },
      );
    }

    let executionId: string;

    try {
      executionId = decodeURIComponent(parts[2]);
    } catch {
      return Response.json(
        {
          error: "Invalid execution path",
        },
        {
          status: 400,
        },
      );
    }

    try {
      const execution = await app.executionStore.getExecution(executionId);

      if (execution === undefined) {
        return Response.json(
          {
            error: "Execution not found",
          },
          {
            status: 404,
          },
        );
      }

      return Response.json(execution);
    } catch (error) {
      console.error("Execution retrieval failed", error);

      return Response.json(
        {
          error: "Execution retrieval failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/plan") {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: "Invalid JSON",
        },
        {
          status: 400,
        },
      );
    }

    const result = parseDesiredState(body);

    if (result.errors.length > 0) {
      return Response.json(
        {
          error: "Invalid desired state",
          errors: result.errors,
        },
        {
          status: 400,
        },
      );
    }

    try {
      const plan = await app.planningService.plan(result.state!);

      return Response.json(plan);
    } catch (error) {
      if (error instanceof NoObservationError) {
        return Response.json(
          {
            error: error.message,
          },
          {
            status: 404,
          },
        );
      }

      console.error("Planning failed", error);

      return Response.json(
        {
          error: "Planning failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/execute") {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: "Invalid JSON",
        },
        {
          status: 400,
        },
      );
    }

    const result = parseDesiredState(body);

    if (result.errors.length > 0) {
      return Response.json(
        {
          error: "Invalid desired state",
          errors: result.errors,
        },
        {
          status: 400,
        },
      );
    }

    try {
      const evaluatedPlan = await app.evaluationService.evaluate(result.state!);

      const blockedOperations = evaluatedPlan.operations.filter(
        (operation) => operation.readiness === "blocked",
      );

      if (blockedOperations.length > 0) {
        return Response.json(
          {
            error: "Execution blocked by policy",
            operations: blockedOperations,
          },
          {
            status: 403,
          },
        );
      }

      const approvalRequiredOperations = evaluatedPlan.operations.filter(
        (operation) => operation.readiness === "approval_required",
      );

      if (approvalRequiredOperations.length > 0) {
        return Response.json(
          {
            error: "Execution requires human approval",
            operations: approvalRequiredOperations,
          },
          {
            status: 409,
          },
        );
      }

      const plan = await app.planningService.plan(result.state!);

      const executionId = crypto.randomUUID();
      const startedAt = new Date().toISOString();

      await app.executionStore.saveExecution({
        id: executionId,
        startedAt,
        status: "running",
      });

      try {
        const summary = await app.executionService.execute(plan);

        const verification = await app.verificationService.verify(
          result.state!,
        );

        const completedAt = new Date().toISOString();

        const execution = {
          id: executionId,
          startedAt,
          completedAt,
          status: summary.status,
          summary,
          verification,
        } as const;

        await app.executionStore.saveExecution(execution);

        return Response.json({
          executionId,
          ...summary,
          verification,
        });
      } catch (executionError) {
        const completedAt = new Date().toISOString();

        await app.executionStore.saveExecution({
          id: executionId,
          startedAt,
          completedAt,
          status: "failed",
        });

        throw executionError;
      }
    } catch (error) {
      if (error instanceof NoObservationError) {
        return Response.json(
          {
            error: error.message,
          },
          {
            status: 404,
          },
        );
      }

      console.error("Execution failed", error);

      return Response.json(
        {
          error: "Execution failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/evaluate") {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: "Invalid JSON",
        },
        {
          status: 400,
        },
      );
    }

    const result = parseDesiredState(body);

    if (result.errors.length > 0) {
      return Response.json(
        {
          error: "Invalid desired state",
          errors: result.errors,
        },
        {
          status: 400,
        },
      );
    }

    try {
      const evaluatedPlan = await app.evaluationService.evaluate(result.state!);

      return Response.json(evaluatedPlan);
    } catch (error) {
      if (error instanceof NoObservationError) {
        return Response.json(
          {
            error: error.message,
          },
          {
            status: 404,
          },
        );
      }

      console.error("Evaluation failed", error);

      return Response.json(
        {
          error: "Evaluation failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/verify") {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: "Invalid JSON",
        },
        {
          status: 400,
        },
      );
    }

    const result = parseDesiredState(body);

    if (result.errors.length > 0) {
      return Response.json(
        {
          error: "Invalid desired state",
          errors: result.errors,
        },
        {
          status: 400,
        },
      );
    }

    try {
      const verification = await app.verificationService.verify(result.state!);

      return Response.json(verification);
    } catch (error) {
      console.error("Verification failed", error);

      return Response.json(
        {
          error: "Verification failed",
        },
        {
          status: 500,
        },
      );
    }
  }

  return new Response("Not Found", {
    status: 404,
  });
}
