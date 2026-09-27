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
  createD1StateStore,
  type ManagementScopeStore,
  type StateStore,
} from "@cloudpilot/state-store";
import { createManagementService, type ManagementService } from "./management";
import { parseManagementResource } from "./management-request";
import { parseManagementResourcePath } from "./management-resource-path";
import { createExecutionService, type ExecutionService } from "./execution";
import type { OperationExecutor } from "@cloudpilot/domain";

export interface App {
  observationService: ObservationService;
  planningService: PlanningService;
  managementService: ManagementService;
  executionService: ExecutionService;
}

export interface AppDependencies {
  inventory: Inventory;
  stateStore: StateStore;
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

  return {
    observationService,
    planningService,
    managementService,
    executionService,
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

  const managementScopeStore = createD1ManagementScopeStore(env.cloudpilot);

  return createApp({
    inventory,
    stateStore,
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
      const plan = await app.planningService.plan(result.state!);
      const report = await app.executionService.execute(plan);

      return Response.json(report);
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

  return new Response("Not Found", {
    status: 404,
  });
}
