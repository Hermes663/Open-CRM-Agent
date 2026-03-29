"use client";

import { useState } from "react";
import { Search, Play, Loader2, User, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { triggerHeartbeat } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, subtitle, backHref, children }: TopBarProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleRunAgent() {
    try {
      setIsRunning(true);
      await triggerHeartbeat();
    } catch (err) {
      console.error("Failed to trigger agent:", err);
    } finally {
      setTimeout(() => setIsRunning(false), 2000);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-sm">
      {/* Left: Page title */}
      <div className="flex items-center gap-3">
        {backHref && (
          <button
            onClick={() => router.push(backHref)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search deals, contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Run Agent button */}
        <button
          onClick={handleRunAgent}
          disabled={isRunning}
          className={cn(
            "btn-primary h-9 gap-1.5 text-xs",
            isRunning && "opacity-75"
          )}
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isRunning ? "Running..." : "Run Agent"}
        </button>

        {/* Extra actions from parent */}
        {children}

        {/* Avatar */}
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
