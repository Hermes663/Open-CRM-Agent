import { NextResponse } from "next/server";

import { listPipelineSummary } from "@/lib/server/crm";

export async function GET() {
  try {
    const summary = await listPipelineSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load pipeline summary" },
      { status: 500 },
    );
  }
}
