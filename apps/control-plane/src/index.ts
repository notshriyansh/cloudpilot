import { authorizeBearer } from "./auth";
import { createProductionApp, handleRequest } from "./app";
import { createCloudPilotMcpHandler } from "./mcp";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const authorization = authorizeBearer(request, env.CLOUDPILOT_MCP_TOKEN);

      if (!authorization.authorized) {
        return authorization.response;
      }

      const app = createProductionApp(env);
      const handler = createCloudPilotMcpHandler(app);

      return handler(request, env, ctx);
    }

    const authorization = authorizeBearer(request, env.CLOUDPILOT_API_TOKEN);

    if (!authorization.authorized) {
      return authorization.response;
    }

    const app = createProductionApp(env);
    return handleRequest(request, app);
  },
} satisfies ExportedHandler<Env>;
