import { authorizeBearer } from "./auth";
import { createProductionApp, handleRequest } from "./app";

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const authorization = authorizeBearer(request, env.CLOUDPILOT_API_TOKEN);

    if (!authorization.authorized) {
      return authorization.response;
    }

    const app = createProductionApp(env);
    return handleRequest(request, app);
  },
} satisfies ExportedHandler<Env>;
