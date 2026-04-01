import { NextRequest, NextResponse } from "next/server";

import { createActivityForDeal, listActivitiesForDeal } from "@/lib/server/crm";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const activities = await listActivitiesForDeal(params.id);
    return NextResponse.json(activities);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load activities" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const activity = await createActivityForDeal(params.id, body);
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400 },
    );
  }
}
