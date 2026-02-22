'use client';

import { useState, useEffect } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Cpu,
  Activity,
  Eye,
  HardDrive,
  Network,
  Settings2,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentConfigEditorProps {
  serverId: string;
}

interface ConfigHistoryItem {
  id: number;
  config_key: string;
  config_value: unknown;
  created_at: string;
  applied_at: string | null;
}

const AGENT_CONFIG_FIELDS = [
  {
    key: 'collection_interval_minutes',
    label: 'Collection Interval',
    type: 'select',
    options: [
      { value: 5, label: '5 minutes' },
      { value: 10, label: '10 minutes' },
      { value: 15, label: '15 minutes' },
      { value: 20, label: '20 minutes' },
      { value: 30, label: '30 minutes' },
      { value: 60, label: '60 minutes' },
    ],
    icon: Clock,
    description: 'How often the agent collects and sends full metrics',
    category: 'collection',
  },
  {
    key: 'top_processes_count',
    label: 'Top Processes Count',
    type: 'number',
    min: 5,
    max: 50,
    icon: Cpu,
    description: 'Number of top processes to report by CPU/memory',
    category: 'collection',
  },
  {
    key: 'collect_processes',
    label: 'Collect Processes',
    type: 'toggle',
    icon: Cpu,
    description: 'Enable process monitoring',
    category: 'collection',
  },
  {
    key: 'collect_disks',
    label: 'Collect Disks',
    type: 'toggle',
    icon: HardDrive,
    description: 'Enable disk usage monitoring',
    category: 'collection',
  },
  {
    key: 'collect_network',
    label: 'Collect Network',
    type: 'toggle',
    icon: Network,
    description: 'Enable network I/O monitoring',
    category: 'collection',
  },
  {
    key: 'auto_discover_services',
    label: 'Auto-Discover Services',
    type: 'toggle',
    icon: Eye,
    description: 'Automatically discover all system services',
    category: 'collection',
  },
  {
    key: 'ping_enabled',
    label: 'Heartbeat Ping',
    type: 'toggle',
    icon: Activity,
    description: 'Send mid-cycle heartbeat pings',
    category: 'collection',
  },
  {
    key: 'live_enabled',
    label: 'Live Performance Mode',
    type: 'toggle',
    icon: Activity,
    description: 'Enable near-live high-frequency performance collection',
    category: 'live',
  },
  {
    key: 'live_interval_seconds',
    label: 'Live Interval',
    type: 'select',
    options: [
      { value: 5, label: '5 seconds' },
      { value: 10, label: '10 seconds' },
      { value: 15, label: '15 seconds' },
      { value: 30, label: '30 seconds' },
      { value: 60, label: '60 seconds' },
    ],
    icon: Clock,
    description: 'How often live performance snapshots are collected',
    category: 'live',
  },
  {
    key: 'live_retention_minutes',
    label: 'Live Data Retention',
    type: 'select',
    options: [
      { value: 15, label: '15 minutes' },
      { value: 30, label: '30 minutes' },
      { value: 60, label: '60 minutes' },
    ],
    icon: Clock,
    description: 'How long live metrics are kept on the dashboard',
    category: 'live',
  },
  {
    key: 'log_level',
    label: 'Log Level',
    type: 'select',
    options: [
      { value: 'DEBUG', label: 'DEBUG' },
      { value: 'INFO', label: 'INFO' },
      { value: 'WARNING', label: 'WARNING' },
      { value: 'ERROR', label: 'ERROR' },
    ],
    icon: Settings2,
    description: 'Agent logging verbosity',
    category: 'advanced',
  },
];

export default function AgentConfigEditor({ serverId }: AgentConfigEditorProps) {
  const [pending, setPending] = useState<Record<string, unknown>>({});
  const [hasPending, setHasPending] = useState(false);
  const [history, setHistory] = useState<ConfigHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [showHistory, setShowHistory] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/dashboard/server/${serverId}/config`);
      const json = await res.json();
      setPending(json.pending || {});
      setHasPending(json.has_pending);
      setHistory(json.history || []);
    } catch (err) {
      console.error('Failed to fetch agent config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 10000);
    return () => clearInterval(interval);
  }, [serverId]);

  const handleSend = async () => {
    const changedKeys = Object.keys(editConfig);
    if (changedKeys.length === 0) {
      setMessage({ type: 'error', text: 'No changes to send' });
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/server/${serverId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: editConfig }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: json.message || 'Config queued successfully' });
        setEditConfig({});
        fetchConfig();
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to send config' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSending(false);
    }
  };

  const updateField = (key: string, value: unknown) => {
    setEditConfig(prev => ({ ...prev, [key]: value }));
  };

  const removeField = (key: string) => {
    setEditConfig(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const hasChanges = Object.keys(editConfig).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    );
  }

  const categories = [
    { id: 'collection', label: 'Collection Settings' },
    { id: 'live', label: 'Live Performance Mode' },
    { id: 'advanced', label: 'Advanced' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-400" />
            Remote Agent Configuration
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Push config changes to the agent. Changes are applied on the agent&apos;s next collection cycle.
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
            showHistory ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
          )}
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>
      </div>

      {/* Pending indicator */}
      {hasPending && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">
            Pending config changes waiting for agent to pick up: {Object.keys(pending).join(', ')}
          </span>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
        )}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Config Fields by Category */}
      {!showHistory && categories.map(cat => {
        const fields = AGENT_CONFIG_FIELDS.filter(f => f.category === cat.id);
        return (
          <div key={cat.id} className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat.label}</h4>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {fields.map(field => {
                const isEdited = field.key in editConfig;
                const currentValue = isEdited ? editConfig[field.key] : (pending[field.key] ?? undefined);
                const Icon = field.icon;

                return (
                  <div key={field.key} className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    isEdited && 'bg-blue-500/5'
                  )}>
                    <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 dark:text-white">{field.label}</div>
                      <div className="text-xs text-gray-500">{field.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {field.type === 'select' && (
                        <select
                          value={currentValue !== undefined ? String(currentValue) : ''}
                          onChange={(e) => {
                            const val = field.options!.some(o => typeof o.value === 'number')
                              ? Number(e.target.value)
                              : e.target.value;
                            if (e.target.value === '') {
                              removeField(field.key);
                            } else {
                              updateField(field.key, val);
                            }
                          }}
                          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 min-w-[130px]"
                        >
                          <option value="">— no change —</option>
                          {field.options!.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={currentValue !== undefined ? String(currentValue) : ''}
                          placeholder="—"
                          onChange={(e) => {
                            if (e.target.value === '') {
                              removeField(field.key);
                            } else {
                              updateField(field.key, Number(e.target.value));
                            }
                          }}
                          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 w-20"
                        />
                      )}
                      {field.type === 'toggle' && (
                        <button
                          onClick={() => {
                            const current = currentValue;
                            if (current === undefined) {
                              updateField(field.key, true);
                            } else if (current === true) {
                              updateField(field.key, false);
                            } else {
                              removeField(field.key);
                            }
                          }}
                          className={cn(
                            'relative w-10 h-5 rounded-full transition-colors',
                            currentValue === true ? 'bg-emerald-500' :
                            currentValue === false ? 'bg-red-500/60' :
                            'bg-gray-300 dark:bg-gray-700'
                          )}
                        >
                          <span className={cn(
                            'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                            currentValue === true ? 'translate-x-5' :
                            currentValue === false ? 'translate-x-0.5' :
                            'translate-x-2.5'
                          )} />
                        </button>
                      )}
                      {isEdited && (
                        <button
                          onClick={() => removeField(field.key)}
                          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                          title="Reset"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Send Button */}
      {!showHistory && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {hasChanges ? `${Object.keys(editConfig).length} change(s) ready to send` : 'Select values to push to agent'}
          </span>
          <button
            onClick={handleSend}
            disabled={!hasChanges || sending}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              hasChanges
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Push to Agent'}
          </button>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Config Change History</h4>
          </div>
          {history.length === 0 ? (
            <div className="p-6 text-center text-gray-600 text-sm">No config changes have been pushed yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800/50 max-h-80 overflow-y-auto">
              {history.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  {item.applied_at ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-mono text-gray-900 dark:text-white">{item.config_key}</span>
                    <span className="text-xs text-gray-500 mx-1">=</span>
                    <span className="text-xs font-mono text-blue-400">{JSON.stringify(item.config_value)}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(item.created_at + 'Z').toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    item.applied_at ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  )}>
                    {item.applied_at ? 'Applied' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
