import { NextResponse } from 'next/server';

const AGENT_API_URL =
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? 'http://localhost:8000';

export async function POST() {
  try {
    const response = await fetch(`${AGENT_API_URL}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Agent API responded with ${response.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await response.json().catch(() => ({ ok: true }));
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to connect to agent API',
      },
      { status: 502 }
    );
  }
}
