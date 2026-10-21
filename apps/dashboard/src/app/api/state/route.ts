import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = process.env.CLOUDPILOT_API_URL;
  const apiToken = process.env.CLOUDPILOT_API_TOKEN;

  if (!apiUrl || !apiToken) {
    return NextResponse.json(
      { error: "CloudPilot API environment variables are not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/state`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("CloudPilot state proxy failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve CloudPilot state" },
      { status: 502 },
    );
  }
}
