import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAgentInterpretRequest } from "../src/agent";

const apiKey = "test-groq-key";

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("https://cloudpilot.test/agent/interpret", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function mockGroqResponse(content: string, status = 200) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("handleAgentInterpretRequest", () => {
  it("returns 503 when the Groq key is missing", async () => {
    const response = await handleAgentInterpretRequest(
      makeRequest({ request: "Inspect infrastructure" }),
      undefined,
    );

    expect(response.status).toBe(503);
  });

  it("rejects unsupported HTTP methods", async () => {
    const response = await handleAgentInterpretRequest(
      makeRequest({}, "GET"),
      apiKey,
    );

    expect(response.status).toBe(405);
  });

  it("rejects empty requests", async () => {
    const response = await handleAgentInterpretRequest(
      makeRequest({ request: "  " }),
      apiKey,
    );

    expect(response.status).toBe(400);
  });

  it("returns a validated inspection proposal without executing it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockGroqResponse(
        JSON.stringify({
          action: "inspect_infrastructure",
          explanation: "Inspect the current infrastructure.",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleAgentInterpretRequest(
      makeRequest({ request: "Inspect infrastructure" }),
      apiKey,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "proposal",
      executed: false,
      proposal: {
        action: "inspect_infrastructure",
        explanation: "Inspect the current infrastructure.",
      },
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${apiKey}`,
    });
  });

  it("rejects unsupported actions returned by Groq", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockGroqResponse(
          JSON.stringify({
            action: "delete_production",
            explanation: "Delete a resource.",
          }),
        ),
      ),
    );

    const response = await handleAgentInterpretRequest(
      makeRequest({ request: "Delete production" }),
      apiKey,
    );

    expect(response.status).toBe(422);
  });

  it("rejects invalid Worker compatibility dates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockGroqResponse(
          JSON.stringify({
            action: "update_disposable_worker",
            explanation: "Update the disposable Worker.",
            script:
              'export default { fetch() { return new Response("ok"); } };',
            compatibilityDate: "not-a-date",
          }),
        ),
      ),
    );

    const response = await handleAgentInterpretRequest(
      makeRequest({ request: "Update the disposable Worker" }),
      apiKey,
    );

    expect(response.status).toBe(422);
  });

  it("returns 502 when Groq responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("Upstream error", { status: 429 })),
    );

    const response = await handleAgentInterpretRequest(
      makeRequest({ request: "Inspect infrastructure" }),
      apiKey,
    );

    expect(response.status).toBe(502);
  });

  it("returns 502 when Groq returns invalid JSON content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockGroqResponse("not json")),
    );

    const response = await handleAgentInterpretRequest(
      makeRequest({ request: "Inspect infrastructure" }),
      apiKey,
    );

    expect(response.status).toBe(502);
  });
});
