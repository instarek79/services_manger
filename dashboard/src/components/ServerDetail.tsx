'use client';

import { useState, useEffect } from 'react';
import { ServerDetailData, ServerInfo } from '@/lib/types';
import { formatBytes, formatUptime, timeAgo, cn, getCpuColor, getMemoryColor } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import CircularGauge from './CircularGauge';
import AlertPanel from './AlertPanel';
import PerformanceMonitor from './PerformanceMonitor';
import AgentConfigEditor from './AgentConfigEditor';
import {
  ArrowLeft,
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Network,
  Monitor,
  Activity,
  Settings,
  Trash2,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface ServerDetailProps {
  serverId: string;
  onBack: () => void;
  onDelete: (id: string) => void;
}

export default function ServerDetail({ serverId, onBack, onDelete }: ServerDetailProps) {
  const [data, setData] = useState<ServerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'processes' | 'services' | 'settings'>('overview');
  const [hours, setHours] = useState(24);
  const [editSettings, setEditSettings] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/dashboard/server/${serverId}?hours=${hours}`);
      const json = await res.json();
      setData(json);
      setEditSettings({
        display_name: json.server.display_name || '',
        group_name: json.server.group_name || 'Default',
        notes: json.server.notes || '',
        alert_cpu_threshold: json.server.alert_cpu_threshold,
        alert_memory_threshold: json.server.alert_memory_threshold,
        alert_disk_threshold: json.server.alert_disk_threshold,
        collection_interval: json.server.collection_interval,
      });
    } catch (err) {
      console.error('Failed to fetch server detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [serverId, hours]);

  const handleAcknowledge = async (alertId: number) => {
    await fetch('/api/dashboard/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });
    fetchData();
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    await fetch(`/api/dashboard/server/${serverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editSettings),
    });
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to remove this server? All data will be lost.')) {
      await fetch(`/api/dashboard/server/${serverId}`, { method: 'DELETE' });
      onDelete(serverId);
      onBack();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-500 py-12">
        Server not found.
        <button onClick={onBack} className="block mx-auto mt-4 text-blue-400 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const { server, metrics, history, processes, services, alerts } = data;

  const chartData = history.map((h) => ({
    time: new Date(h.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cpu: h.cpu_percent,
    memory: h.memory_percent,
  }));

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Activity },
    { id: 'performance' as const, label: 'Performance', icon: Cpu },
    { id: 'processes' as const, label: 'Processes', icon: Cpu },
    { id: 'services' as const, label: 'Services', icon: Monitor },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {server.display_name || server.hostname}
          </h2>
          <p className="text-sm text-gray-500">
            {server.ip_address} &middot; {server.os_info} &middot; Group: {server.group_name}
          </p>
        </div>
        <StatusBadge status={(server as unknown as ServerInfo).status || 'offline'} />
        <button
          onClick={fetchData}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg p-1 border border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm dark:shadow-none'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Gauges Row */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col items-center shadow-sm dark:shadow-none">
                <CircularGauge
                  value={metrics.cpu_percent}
                  color={getCpuColor(metrics.cpu_percent)}
                  label="CPU Usage"
                  size={100}
                  strokeWidth={8}
                />
              </div>
              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col items-center shadow-sm dark:shadow-none">
                <CircularGauge
                  value={metrics.memory_percent}
                  color={getMemoryColor(metrics.memory_percent)}
                  label="Memory"
                  sublabel={`${formatBytes(metrics.memory_used)} / ${formatBytes(metrics.memory_total)}`}
                  size={100}
                  strokeWidth={8}
                />
              </div>
              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm dark:shadow-none">
                <Clock className="w-8 h-8 text-blue-400" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">{formatUptime(metrics.uptime_seconds)}</span>
                <span className="text-xs text-gray-500">Uptime</span>
              </div>
              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm dark:shadow-none">
                <Network className="w-8 h-8 text-violet-400" />
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatBytes(metrics.network?.bytes_sent || 0)} sent
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatBytes(metrics.network?.bytes_recv || 0)} recv
                </span>
                <span className="text-xs text-gray-500">Network I/O</span>
              </div>
            </div>
          )}

          {/* Disk Usage */}
          {metrics?.disks && metrics.disks.length > 0 && (
            <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-violet-400" />
                Disk Usage
              </h3>
              <div className="space-y-3">
                {metrics.disks.map((disk, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{disk.mountpoint} ({disk.device})</span>
                      <span className="text-gray-500">
                        {formatBytes(disk.used)} / {formatBytes(disk.total)} ({disk.percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          disk.percent >= 90 ? 'bg-red-500' :
                          disk.percent >= 70 ? 'bg-amber-500' :
                          'bg-violet-500'
                        )}
                        style={{ width: `${disk.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          {chartData.length > 0 && (
            <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Performance History
                </h3>
                <div className="flex gap-1">
                  {[6, 12, 24, 48, 72].map((h) => (
                    <button
                      key={h}
                      onClick={() => setHours(h)}
                      className={cn(
                        'px-2 py-1 text-xs rounded',
                        hours === h ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Area type="monotone" dataKey="cpu" stroke="#10b981" fill="url(#cpuGrad)" name="CPU %" />
                    <Area type="monotone" dataKey="memory" stroke="#3b82f6" fill="url(#memGrad)" name="Memory %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Alerts */}
          <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <PerformanceMonitor serverId={serverId} />
      )}

      {/* Processes Tab */}
      {activeTab === 'processes' && (
        <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Top Processes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 text-xs">
                  <th className="text-left p-3">PID</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">User</th>
                  <th className="text-right p-3">CPU %</th>
                  <th className="text-right p-3">Memory %</th>
                  <th className="text-right p-3">Memory</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-600">
                      No process data available
                    </td>
                  </tr>
                ) : (
                  processes.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="p-3 text-gray-400 font-mono">{p.pid}</td>
                      <td className="p-3 text-gray-900 dark:text-white font-medium">{p.name}</td>
                      <td className="p-3 text-gray-400">{p.username}</td>
                      <td className="p-3 text-right">
                        <span className={cn(
                          'font-mono',
                          p.cpu_percent >= 50 ? 'text-red-400' :
                          p.cpu_percent >= 20 ? 'text-amber-400' :
                          'text-gray-300'
                        )}>
                          {p.cpu_percent.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={cn(
                          'font-mono',
                          p.memory_percent >= 50 ? 'text-red-400' :
                          p.memory_percent >= 20 ? 'text-amber-400' :
                          'text-gray-300'
                        )}>
                          {p.memory_percent.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-3 text-right text-gray-400 font-mono">
                        {p.memory_mb.toFixed(1)} MB
                      </td>
                      <td className="p-3">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          p.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-gray-500/20 text-gray-400'
                        )}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              Monitored Services
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 text-xs">
                  <th className="text-left p-3">Service</th>
                  <th className="text-left p-3">Display Name</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Start Type</th>
                  <th className="text-right p-3">PID</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-600">
                      No service data available
                    </td>
                  </tr>
                ) : (
                  services.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="p-3 text-gray-900 dark:text-white font-medium font-mono">{s.service_name}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{s.display_name}</td>
                      <td className="p-3">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          s.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' :
                          s.status === 'stopped' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        )}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400">{s.start_type}</td>
                      <td className="p-3 text-right text-gray-400 font-mono">{s.pid || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            Server Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name</label>
              <input
                type="text"
                value={(editSettings.display_name as string) || ''}
                onChange={(e) => setEditSettings({ ...editSettings, display_name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Group</label>
              <input
                type="text"
                value={(editSettings.group_name as string) || ''}
                onChange={(e) => setEditSettings({ ...editSettings, group_name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea
                value={(editSettings.notes as string) || ''}
                onChange={(e) => setEditSettings({ ...editSettings, notes: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 h-20 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">CPU Alert Threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={(editSettings.alert_cpu_threshold as number) || 90}
                onChange={(e) => setEditSettings({ ...editSettings, alert_cpu_threshold: Number(e.target.value) })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Memory Alert Threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={(editSettings.alert_memory_threshold as number) || 90}
                onChange={(e) => setEditSettings({ ...editSettings, alert_memory_threshold: Number(e.target.value) })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Disk Alert Threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={(editSettings.alert_disk_threshold as number) || 90}
                onChange={(e) => setEditSettings({ ...editSettings, alert_disk_threshold: Number(e.target.value) })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Collection Interval (minutes)</label>
              <select
                value={(editSettings.collection_interval as number) || 10}
                onChange={(e) => setEditSettings({ ...editSettings, collection_interval: Number(e.target.value) })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Remove Server
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Remote Agent Config */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <AgentConfigEditor serverId={serverId} />
          </div>

          {/* Server Info (read-only) */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <h4 className="text-xs text-gray-500 mb-3">Server Information (read-only)</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-600">ID:</span> <span className="text-gray-400 font-mono">{server.id}</span></div>
              <div><span className="text-gray-600">Hostname:</span> <span className="text-gray-400">{server.hostname}</span></div>
              <div><span className="text-gray-600">IP:</span> <span className="text-gray-400">{server.ip_address}</span></div>
              <div><span className="text-gray-600">OS:</span> <span className="text-gray-400">{server.os_info}</span></div>
              <div><span className="text-gray-600">Registered:</span> <span className="text-gray-400">{server.registered_at}</span></div>
              <div><span className="text-gray-600">Last Seen:</span> <span className="text-gray-400">{server.last_seen_at ? timeAgo(server.last_seen_at) : 'Never'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
