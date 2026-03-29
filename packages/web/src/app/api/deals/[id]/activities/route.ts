import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const supabase = createClient();
  const { id } = params;

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = createClient();
  const { id } = params;

  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('activities')
      .insert({
        deal_id: id,
        activity_type: body.activity_type ?? 'note_added',
        description: body.description ?? '',
        body: body.body ?? null,
        metadata: body.metadata ?? {},
        agent_name: body.agent_name ?? null,
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
