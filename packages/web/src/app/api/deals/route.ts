import { NextRequest, NextResponse } from "next/server";

import { createDeal, listDeals } from "@/lib/server/crm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");
    const deals = await listDeals(stage);
    return NextResponse.json(deals);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load deals" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deal = await createDeal(body);
    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400 },
    );
  }
}
