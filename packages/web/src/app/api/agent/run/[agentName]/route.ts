import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: { agentName: string };
}

const AGENT_API_URL = process.env.AGENT_API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const response = await fetch(`${AGENT_API_URL}/agent/run/${params.agentName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.detail ?? payload.error ?? "Agent API request failed" },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to proxy agent request",
      },
      { status: 502 },
    );
  }
}
