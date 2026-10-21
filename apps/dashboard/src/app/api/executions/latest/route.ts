import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.CLOUDPILOT_API_URL;
  const token = process.env.CLOUDPILOT_API_TOKEN;

  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: "Control plane API is not configured." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/executions/latest`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Latest execution proxy failed", error);

    return NextResponse.json(
      { error: "Unable to reach the control plane." },
      { status: 502 },
    );
  }
}
