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

      let mcpRequest = request;

      try {
        const body: unknown = await request.clone().json();

        if (
          typeof body === "object" &&
          body !== null &&
          !Array.isArray(body) &&
          "_iam_context" in body
        ) {
          const { _iam_context: _iamContext, ...jsonRpcBody } = body as Record<
            string,
            unknown
          >;

          const headers = new Headers(request.headers);
          headers.delete("content-length");

          mcpRequest = new Request(request.url, {
            method: request.method,
            headers,
            body: JSON.stringify(jsonRpcBody),
          });
        }
      } catch {}

      return handler(mcpRequest, env, ctx);
    }

    const authorization = authorizeBearer(request, env.CLOUDPILOT_API_TOKEN);

    if (!authorization.authorized) {
      return authorization.response;
    }

    const app = createProductionApp(env);
    return handleRequest(request, app);
  },
} satisfies ExportedHandler<Env>;
