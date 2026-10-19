import { NextResponse } from "next/server";

function getControlPlaneConfig() {
  const baseUrl = process.env.CLOUDPILOT_API_URL;
  const token = process.env.CLOUDPILOT_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Control plane API is not configured.");
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
}

async function proxy(request: Request, method: "GET" | "PUT") {
  try {
    const { baseUrl, token } = getControlPlaneConfig();
    const body = method === "PUT" ? await request.text() : undefined;

    const response = await fetch(`${baseUrl}/desired-state`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Desired state proxy failed", error);

    return NextResponse.json(
      { error: "Unable to reach the control plane." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  return proxy(request, "GET");
}

export async function PUT(request: Request) {
  return proxy(request, "PUT");
}
