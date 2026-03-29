'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import DealInfoCard from '@/components/deals/DealInfoCard';
import ActivityTimeline from '@/components/deals/ActivityTimeline';
import ContactCard from '@/components/deals/ContactCard';
import QuickActions from '@/components/deals/QuickActions';
import type { DealWithRelations, PipelineStage } from '@/lib/types';

export default function DealDetailPage() {
  const params = useParams();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<DealWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeal() {
      try {
        const res = await fetch(`/api/deals/${dealId}`);
        if (!res.ok) throw new Error('Deal not found');
        const data = await res.json();
        setDeal(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load deal');
      } finally {
        setLoading(false);
      }
    }

    if (dealId) loadDeal();
  }, [dealId]);

  async function handleStageChange(newStage: PipelineStage) {
    if (!deal) return;
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title="Deal Not Found" backHref="/pipeline" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-slate-500">{error ?? 'Deal not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar
        title={deal.company_name}
        subtitle={deal.contact_name ?? undefined}
        backHref="/pipeline"
      />

      <div className="flex-1 p-6">
        <div className="flex gap-6">
          {/* Left column: Deal Info */}
          <div className="w-[300px] shrink-0">
            <DealInfoCard deal={deal} onStageChange={handleStageChange} />
          </div>

          {/* Center column: Activity Timeline */}
          <div className="min-w-0 flex-1">
            <ActivityTimeline activities={deal.activities} />
          </div>

          {/* Right column: Contact + Quick Actions */}
          <div className="w-[300px] shrink-0 space-y-4">
            <ContactCard customer={deal.customer} />
            <QuickActions
              dealId={deal.id}
              currentStage={deal.stage}
              onStageChange={handleStageChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
