import { describe, expect, it } from "vitest";
import { authorizeBearer } from "../src/auth";

const token = "test-cloudpilot-token";

function request(authorization?: string): Request {
  return new Request("https://example.com/inspect", {
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe("authorizeBearer", () => {
  it("allows a valid bearer token", () => {
    expect(authorizeBearer(request(`Bearer ${token}`), token)).toEqual({
      authorized: true,
    });
  });

  it("rejects a missing token", () => {
    const result = authorizeBearer(request(), token);

    expect(result.authorized).toBe(false);

    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });

  it("rejects an invalid token", () => {
    const result = authorizeBearer(request("Bearer incorrect"), token);

    expect(result.authorized).toBe(false);

    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });

  it("fails closed when the server token is not configured", () => {
    const result = authorizeBearer(request(`Bearer ${token}`), undefined);

    expect(result.authorized).toBe(false);

    if (!result.authorized) {
      expect(result.response.status).toBe(503);
    }
  });
});
