import { createCloudflareProvider } from "@cloudpilot/cloudflare-provider";
import { createInventory, type Inventory } from "@cloudpilot/inventory";
import { createD1StateStore, type StateStore } from "@cloudpilot/state-store";
import {
  createObservationService,
  type Clock,
  type IdGenerator,
  type ObservationService,
} from "./observation";

export interface App {
  observationService: ObservationService;
}

export interface AppDependencies {
  inventory: Inventory;
  stateStore: StateStore;
  clock: Clock;
  idGenerator: IdGenerator;
}

export function createApp(dependencies: AppDependencies): App {
  const observationService = createObservationService(
    dependencies.inventory,
    dependencies.stateStore,
    dependencies.clock,
    dependencies.idGenerator,
  );

  return {
    observationService,
  };
}

export function createProductionApp(env: Env) {
  const provider = createCloudflareProvider({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
  });

  const inventory = createInventory(provider);
  const stateStore = createD1StateStore(env.cloudpilot);

  return createApp({
    inventory,
    stateStore,
    clock: {
      now: () => new Date(),
    },
    idGenerator: {
      generate: () => crypto.randomUUID(),
    },
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
    } catch {
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

  return new Response("Not Found", {
    status: 404,
  });
}
