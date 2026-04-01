"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Search } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { getContacts } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type SortField =
  | "full_name"
  | "company_name"
  | "email"
  | "country"
  | "created_at";
type SortDir = "asc" | "desc";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    async function loadContacts() {
      try {
        const data = await getContacts();
        setContacts(data);
      } catch (error) {
        console.error("Failed to load contacts:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadContacts();
  }, []);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }

    setSortField(field);
    setSortDir("asc");
  }

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = contacts.filter((contact) => {
      if (!query) {
        return true;
      }

      return (
        contact.full_name.toLowerCase().includes(query) ||
        contact.company_name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query)
      );
    });

    return result.sort((left, right) => {
      const leftValue = String(left[sortField] ?? "");
      const rightValue = String(right[sortField] ?? "");
      const comparison = leftValue.localeCompare(rightValue);
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [contacts, searchQuery, sortField, sortDir]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
    }

    return sortDir === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Contacts" subtitle={`${filtered.length} contacts`} />

      <div className="p-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search contacts by name, company, or email..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {([
                    ["full_name", "Name"],
                    ["company_name", "Company"],
                    ["email", "Email"],
                    ["country", "Country"],
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
                    Deals
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Last Contact
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  filtered.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {contact.full_name
                              .split(" ")
                              .map((name) => name[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">
                            {contact.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {contact.company_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{contact.email}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {contact.country ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {contact.language ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {contact.deal_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {contact.last_contact
                          ? formatRelativeTime(contact.last_contact)
                          : "-"}
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
