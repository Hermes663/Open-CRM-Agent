'use client';

import { useState } from 'react';
import { Save, Github, BookOpen, Settings2, Mail, Layers, Info } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/lib/constants';

type Tab = 'agent' | 'email' | 'pipeline' | 'about';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'agent', label: 'Agent Configuration', icon: Settings2 },
  { id: 'email', label: 'Email Provider', icon: Mail },
  { id: 'pipeline', label: 'Pipeline Stages', icon: Layers },
  { id: 'about', label: 'About', icon: Info },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('agent');
  const [soulMd, setSoulMd] = useState(
    '# AutoSales AI SOUL\n\nYou are a professional B2B sales agent...\n\n## Persona\n- Professional and friendly\n- Data-driven approach\n- Focus on value proposition\n\n## Rules\n- Always personalize emails\n- Research before outreach\n- Follow up within 3 days'
  );
  const [heartbeatInterval, setHeartbeatInterval] = useState(300);
  const [emailProvider, setEmailProvider] = useState<'outlook' | 'gmail' | 'imap'>('outlook');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // Placeholder save logic
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Settings" />

      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="card">
            {/* Agent Configuration */}
            {activeTab === 'agent' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Agent Configuration
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Configure your AI sales agent behavior and personality.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    SOUL.md Content
                  </label>
                  <p className="mb-2 text-xs text-slate-400">
                    This defines the agent&apos;s personality, rules, and behavior.
                  </p>
                  <textarea
                    value={soulMd}
                    onChange={(e) => setSoulMd(e.target.value)}
                    rows={16}
                    className="input font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Heartbeat Interval
                  </label>
                  <p className="mb-2 text-xs text-slate-400">
                    How often the agent checks for new tasks (in seconds).
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={60}
                      max={3600}
                      step={60}
                      value={heartbeatInterval}
                      onChange={(e) =>
                        setHeartbeatInterval(Number(e.target.value))
                      }
                      className="flex-1"
                    />
                    <span className="w-20 text-right text-sm font-semibold text-slate-700">
                      {heartbeatInterval}s
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}

            {/* Email Provider */}
            {activeTab === 'email' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Email Provider
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Configure how the agent sends and receives emails.
                  </p>
                </div>

                <div className="space-y-3">
                  {(['outlook', 'gmail', 'imap'] as const).map((provider) => (
                    <label
                      key={provider}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                        emailProvider === provider
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="emailProvider"
                        value={provider}
                        checked={emailProvider === provider}
                        onChange={() => setEmailProvider(provider)}
                        className="text-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">
                          {provider === 'imap' ? 'IMAP / SMTP' : provider === 'gmail' ? 'Gmail' : 'Outlook'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {provider === 'outlook' && 'Microsoft Graph API integration'}
                          {provider === 'gmail' && 'Google Workspace API integration'}
                          {provider === 'imap' && 'Custom IMAP/SMTP server configuration'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {emailProvider === 'imap' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        IMAP Host
                      </label>
                      <input type="text" className="input mt-1" placeholder="imap.example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        IMAP Port
                      </label>
                      <input type="text" className="input mt-1" placeholder="993" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        SMTP Host
                      </label>
                      <input type="text" className="input mt-1" placeholder="smtp.example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        SMTP Port
                      </label>
                      <input type="text" className="input mt-1" placeholder="587" />
                    </div>
                  </div>
                )}

                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Email Settings'}
                </button>
              </div>
            )}

            {/* Pipeline Stages */}
            {activeTab === 'pipeline' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Pipeline Stages
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Configure the stages in your sales pipeline.
                  </p>
                </div>

                <div className="space-y-2">
                  {PIPELINE_STAGES.map((stage, idx) => (
                    <div
                      key={stage.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm text-slate-400 font-mono w-6">
                        {idx + 1}
                      </span>
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: stage.hex }}
                      />
                      <span className="flex-1 text-sm font-medium text-slate-700">
                        {stage.label}
                      </span>
                      <span className="text-xs text-slate-400">{stage.id}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-400">
                  Drag to reorder stages (coming soon). Stage changes are applied to all deals.
                </p>
              </div>
            )}

            {/* About */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    About AutoSales AI
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    AI-powered B2B sales development representative.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-600">Version</span>
                    <span className="text-sm font-semibold text-slate-900">
                      0.1.0-beta
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-600">Framework</span>
                    <span className="text-sm font-semibold text-slate-900">
                      Next.js 14 + Supabase
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-600">Agent Engine</span>
                    <span className="text-sm font-semibold text-slate-900">
                      Python FastAPI + Claude/OpenAI
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                  </a>
                  <a
                    href="#"
                    className="btn-secondary"
                  >
                    <BookOpen className="h-4 w-4" />
                    Documentation
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
