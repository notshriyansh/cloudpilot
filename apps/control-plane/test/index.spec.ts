import {
  createExecutionContext,
  env,
  SELF,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("CloudPilot control plane", () => {
  it("responds correctly when invoked directly", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("CloudPilot control plane");
  });

  it("responds correctly through the Worker runtime", async () => {
    const response = await SELF.fetch("https://example.com");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("CloudPilot control plane");
  });
});
