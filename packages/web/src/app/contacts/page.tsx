'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { formatRelativeTime } from '@/lib/utils';
import { createClient } from '@/lib/supabase';

interface Prospect {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  country: string | null;
  language: string | null;
  created_at: string;
  deal_count?: number;
  last_contact?: string | null;
}

type SortField = 'full_name' | 'company_name' | 'email' | 'country' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function ContactsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    async function loadProspects() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!error && data) {
        setProspects(data as Prospect[]);
      }
      setLoading(false);
    }

    loadProspects();
  }, []);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let result = prospects;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(q) ||
          p.company_name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aVal = (a[sortField] ?? '') as string;
      const bVal = (b[sortField] ?? '') as string;
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [prospects, searchQuery, sortField, sortDir]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Contacts" subtitle={`${filtered.length} contacts`} />

      <div className="p-6">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search contacts by name, company, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {([
                    ['full_name', 'Name'],
                    ['company_name', 'Company'],
                    ['email', 'Email'],
                    ['country', 'Country'],
                  ] as const).map(([field, label]) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      className="cursor-pointer px-4 py-3 text-left font-medium text-slate-600 transition-colors hover:text-slate-900"
                    >
                      <span className="flex items-center gap-1.5">
                        {label}
                        <SortIcon field={field} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Language
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Last Contact
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  filtered.map((prospect) => (
                    <tr
                      key={prospect.id}
                      onClick={() => router.push(`/contacts/${prospect.id}`)}
                      className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {prospect.full_name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">
                            {prospect.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {prospect.company_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{prospect.email}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {prospect.country ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {prospect.language ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {prospect.last_contact
                          ? formatRelativeTime(prospect.last_contact)
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
