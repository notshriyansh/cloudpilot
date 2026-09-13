import { createCloudflareProvider } from "@cloudpilot/cloudflare-provider";
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

export interface App {
  observationService: ObservationService;
  planningService: PlanningService;
  managementService: ManagementService;
}

export interface AppDependencies {
  inventory: Inventory;
  stateStore: StateStore;
  clock: Clock;
  idGenerator: IdGenerator;
  managementScopeStore: ManagementScopeStore;
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

  return {
    observationService,
    planningService,
    managementService,
  };
}

export function createProductionApp(env: Env) {
  const provider = createCloudflareProvider({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
  });

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

  return new Response("Not Found", {
    status: 404,
  });
}
