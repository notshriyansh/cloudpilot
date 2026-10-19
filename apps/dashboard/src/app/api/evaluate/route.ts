import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const baseUrl = process.env.CLOUDPILOT_API_URL;
    const token = process.env.CLOUDPILOT_API_TOKEN;

    if (!baseUrl || !token) {
      return NextResponse.json(
        { error: "Control plane API is not configured." },
        { status: 500 },
      );
    }

    const body = await request.text();

    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/evaluate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Evaluation proxy failed", error);

    return NextResponse.json(
      { error: "Unable to reach the control plane." },
      { status: 502 },
    );
  }
}
