import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get('stage');

  let query = supabase
    .from('deals')
    .select('*')
    .order('updated_at', { ascending: false });

  if (stage) {
    query = query.eq('stage', stage);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('deals')
      .insert({
        company_name: body.company_name,
        contact_name: body.contact_name ?? null,
        contact_email: body.contact_email ?? null,
        value: body.value ?? 0,
        stage: body.stage ?? 'new_deal',
        priority_score: body.priority_score ?? 50,
        agent_name: body.agent_name ?? null,
        stage_entered_at: new Date().toISOString(),
        owner_id: body.owner_id ?? null,
        notes: body.notes ?? null,
        customer_id: body.customer_id ?? null,
        tags: body.tags ?? [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
