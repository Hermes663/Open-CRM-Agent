import { NextResponse } from "next/server";

import { getSettingsStatus } from "@/lib/server/crm";

export async function GET() {
  try {
    const status = await getSettingsStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings status" },
      { status: 500 },
    );
  }
}
