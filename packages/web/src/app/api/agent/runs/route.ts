import { NextRequest, NextResponse } from "next/server";

import { listAgentRuns } from "@/lib/server/crm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;
    const runs = await listAgentRuns(limit);
    return NextResponse.json(runs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load agent runs" },
      { status: 500 },
    );
  }
}
