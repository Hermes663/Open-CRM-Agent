'use client';

import { useState } from 'react';
import { Mail, Phone, Globe, MessageSquare } from 'lucide-react';
import type { Customer } from '@/lib/types';

// Simple country code to flag emoji mapping
function countryFlag(code: string | null | undefined): string {
  if (!code) return '';
  const cleaned = code.toUpperCase().trim();
  if (cleaned.length !== 2) return cleaned;
  return String.fromCodePoint(
    ...cleaned.split('').map((c) => 127397 + c.charCodeAt(0))
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface ContactCardProps {
  customer: Customer | null;
}

export default function ContactCard({ customer }: ContactCardProps) {
  const [showFullResearch, setShowFullResearch] = useState(false);

  if (!customer) {
    return (
      <div className="card flex items-center justify-center py-8">
        <p className="text-sm text-slate-400">No contact linked</p>
      </div>
    );
  }

  const researchTruncated =
    customer.research_summary && customer.research_summary.length > 200;

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Contact
      </h3>

      {/* Avatar + Name */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
          {getInitials(customer.full_name)}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{customer.full_name}</p>
          <p className="text-sm text-slate-500">{customer.company_name}</p>
        </div>
      </div>

      {/* Email */}
      <a
        href={`mailto:${customer.email}`}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
      >
        <Mail className="h-4 w-4" />
        {customer.email}
      </a>

      {/* Phone */}
      {customer.phone && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Phone className="h-4 w-4 text-slate-400" />
          {customer.phone}
        </div>
      )}

      {/* Country */}
      {customer.country && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Globe className="h-4 w-4 text-slate-400" />
          <span>{countryFlag(customer.country)}</span>
          {customer.country}
        </div>
      )}

      {/* Language */}
      {customer.language && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MessageSquare className="h-4 w-4 text-slate-400" />
          {customer.language}
        </div>
      )}

      {/* Research summary */}
      {customer.research_summary && (
        <div className="border-t border-slate-100 pt-3">
          <label className="text-xs font-medium text-slate-400">
            Research Summary
          </label>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {showFullResearch
              ? customer.research_summary
              : customer.research_summary.slice(0, 200)}
            {researchTruncated && !showFullResearch && '...'}
          </p>
          {researchTruncated && (
            <button
              onClick={() => setShowFullResearch(!showFullResearch)}
              className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {showFullResearch ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
