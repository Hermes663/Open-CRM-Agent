import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const supabase = createClient();
  const { id } = params;

  // Fetch deal
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single();

  if (dealError) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Fetch customer and activities in parallel
  const [customerResult, activitiesResult] = await Promise.all([
    deal.customer_id
      ? supabase
          .from('prospects_data')
          .select('*')
          .eq('id', deal.customer_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('activities')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    ...deal,
    customer: customerResult.data ?? null,
    activities: activitiesResult.data ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createClient();
  const { id } = params;

  try {
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // If stage is changing, update stage_entered_at
    if (body.stage) {
      updateData.stage_entered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('deals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log stage change activity
    if (body.stage) {
      await supabase.from('activities').insert({
        deal_id: id,
        activity_type: 'stage_changed',
        description: `Stage changed to ${body.stage}`,
        metadata: { new_stage: body.stage },
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
