import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('deals')
    .select('stage, value, value_pln');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summaryMap = new Map<
    string,
    { stage: string; count: number; total_value: number }
  >();

  for (const deal of data ?? []) {
    const existing = summaryMap.get(deal.stage);
    const dealValue = deal.value ?? deal.value_pln ?? 0;

    if (existing) {
      existing.count += 1;
      existing.total_value += dealValue;
    } else {
      summaryMap.set(deal.stage, {
        stage: deal.stage,
        count: 1,
        total_value: dealValue,
      });
    }
  }

  return NextResponse.json(Array.from(summaryMap.values()));
}
