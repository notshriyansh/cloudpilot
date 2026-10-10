export type AuthorizationResult =
  | { authorized: true }
  | {
      authorized: false;
      response: Response;
    };

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);

  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return difference === 0;
}

export function authorizeBearer(
  request: Request,
  expectedToken: string | undefined,
): AuthorizationResult {
  if (!expectedToken || expectedToken.trim().length === 0) {
    return {
      authorized: false,
      response: Response.json(
        { error: "Authentication is not configured" },
        { status: 503 },
      ),
    };
  }

  const authorization = request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  const suppliedToken = match?.[1];

  if (
    suppliedToken === undefined ||
    !constantTimeEqual(suppliedToken, expectedToken)
  ) {
    return {
      authorized: false,
      response: Response.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": "Bearer",
          },
        },
      ),
    };
  }

  return { authorized: true };
}
