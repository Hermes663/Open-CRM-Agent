"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Settings,
  Bot,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/agent", label: "Agent Runs", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-sidebar flex-col bg-sidebar-bg">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-text-active">
            AutoSales AI
          </h1>
          <p className="text-xs text-sidebar-text">Sales CRM</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-700/50" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-sidebar-text-active"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Agent status */}
      <div className="border-t border-slate-700/50 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="h-5 w-5 text-sidebar-text" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-bg bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-sidebar-text-active">
              AI Agent
            </p>
            <p className="truncate text-xs text-sidebar-text">Running</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
