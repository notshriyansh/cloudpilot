import {
  createExecutionContext,
  env,
  SELF,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const authHeaders = {
  Authorization: `Bearer ${env.CLOUDPILOT_API_TOKEN}`,
};

describe("CloudPilot control plane", () => {
  it("rejects requests without authentication", async () => {
    const response = await SELF.fetch("https://example.com/");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("returns 404 for unknown routes when invoked directly", async () => {
    const request = new IncomingRequest("http://example.com/", {
      headers: authHeaders,
    });
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns 404 for unknown routes through the Worker runtime", async () => {
    const response = await SELF.fetch("https://example.com/", {
      headers: authHeaders,
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("rejects unauthenticated MCP requests", async () => {
    const response = await SELF.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "cloudpilot-test",
            version: "1.0.0",
          },
        },
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
