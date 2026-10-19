import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.CLOUDPILOT_API_URL;
  const token = process.env.CLOUDPILOT_API_TOKEN;

  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: "CloudPilot API configuration is missing." },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${baseUrl.replace(/\/+$/, "")}/inspect`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the CloudPilot control plane." },
      { status: 502 },
    );
  }
}
