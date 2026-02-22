'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardData, NotificationInfo } from '@/lib/types';
import SummaryCards, { SummaryCardType } from './SummaryCards';
import ServerCard from './ServerCard';
import AlertPanel from './AlertPanel';
import NotificationBell from './NotificationBell';
import ServerDetail from './ServerDetail';
import EnvironmentOverview from './EnvironmentOverview';
import GlobalSettings from './GlobalSettings';
import { DashboardSkeleton } from './LoadingSkeleton';
import ServerComparison from './ServerComparison';
import {
  LayoutGrid,
  List,
  Search,
  Filter,
  RefreshCw,
  Shield,
  Moon,
  Sun,
  Map,
  Download,
  Settings,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAlerts, setShowAlerts] = useState(false);
  const [showOverview, setShowOverview] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [activeSummaryCard, setActiveSummaryCard] = useState<SummaryCardType | null>(null);

  // Sync darkMode state with html class for CSS variables
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/notifications');
      const json = await res.json();
      setNotifications(json.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchNotifications();
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDashboard();
        fetchNotifications();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchDashboard, fetchNotifications, autoRefresh]);

  const handleAcknowledge = async (alertId: number) => {
    await fetch('/api/dashboard/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });
    fetchDashboard();
  };

  const handleMarkNotificationRead = async (id: number) => {
    await fetch('/api/dashboard/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: id }),
    });
    fetchNotifications();
  };

  const handleMarkAllNotificationsRead = async () => {
    await fetch('/api/dashboard/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    });
    fetchNotifications();
  };

  // Filter servers
  const filteredServers = data?.servers?.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ip_address?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = filterGroup === 'all' || s.group_name === filterGroup;
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesGroup && matchesStatus;
  }) || [];

  // Group servers
  const groupedServers: Record<string, typeof filteredServers> = {};
  filteredServers.forEach((s) => {
    const group = s.group_name || 'Default';
    if (!groupedServers[group]) groupedServers[group] = [];
    groupedServers[group].push(s);
  });

  const pageBg = darkMode ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-900';

  if (showSettings) {
    return (
      <div className={cn('min-h-screen p-6', pageBg)}>
        <div className="max-w-4xl mx-auto">
          <GlobalSettings onBack={() => setShowSettings(false)} />
        </div>
      </div>
    );
  }

  if (selectedServer) {
    return (
      <div className={cn('min-h-screen p-6', pageBg)}>
        <div className="max-w-7xl mx-auto">
          <ServerDetail
            serverId={selectedServer}
            onBack={() => setSelectedServer(null)}
            onDelete={() => {
              setSelectedServer(null);
              fetchDashboard();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen transition-colors', darkMode ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-900')}>
      {/* Top Bar */}
      <header className={cn(
        'sticky top-0 z-40 border-b backdrop-blur-xl',
        darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/80 border-gray-200'
      )}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-blue-500" />
            <div>
              <h1 className="text-lg font-bold">Server Monitor</h1>
              <p className={cn('text-xs', darkMode ? 'text-gray-500' : 'text-gray-400')}>
                Infrastructure Monitoring Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                autoRefresh ? 'text-emerald-400 bg-emerald-500/10' : darkMode ? 'text-gray-500 hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-200'
              )}
              title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
            >
              <RefreshCw className={cn('w-4 h-4', autoRefresh && 'animate-spin')} style={{ animationDuration: '3s' }} />
            </button>
            <button
              onClick={() => {
                fetchDashboard();
                fetchNotifications();
              }}
              className={cn('p-2 rounded-lg transition-colors', darkMode ? 'text-gray-500 hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-200')}
              title="Refresh now"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <NotificationBell
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
            />
            <button
              onClick={() => setShowSettings(true)}
              className={cn('p-2 rounded-lg transition-colors', darkMode ? 'text-gray-500 hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-200')}
              title="Global Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={cn('p-2 rounded-lg transition-colors', darkMode ? 'text-gray-500 hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-200')}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <DashboardSkeleton />
        ) : data ? (
          <>
            {/* Summary Cards */}
            <SummaryCards
              summary={data.summary}
              activeCard={activeSummaryCard}
              onCardClick={(cardType) => {
                if (activeSummaryCard === cardType) {
                  // Toggle off
                  setActiveSummaryCard(null);
                  setFilterStatus('all');
                  setShowAlerts(false);
                } else {
                  setActiveSummaryCard(cardType);
                  // Apply appropriate filter/action
                  if (cardType === 'total') {
                    setFilterStatus('all');
                    setShowAlerts(false);
                  } else if (cardType === 'online') {
                    setFilterStatus('online');
                    setShowAlerts(false);
                  } else if (cardType === 'offline') {
                    setFilterStatus('offline');
                    setShowAlerts(false);
                  } else if (cardType === 'alerts') {
                    setFilterStatus('all');
                    setShowAlerts(true);
                  } else if (cardType === 'critical') {
                    setFilterStatus('critical');
                    setShowAlerts(true);
                  } else if (cardType === 'notifications') {
                    setFilterStatus('all');
                    setShowAlerts(false);
                  }
                }
              }}
            />

            {/* Summary Card Detail Panel */}
            {activeSummaryCard && (
              <div className={cn(
                'rounded-xl border p-4 transition-all animate-in fade-in slide-in-from-top-2 duration-200',
                darkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-gray-200'
              )}>
                {activeSummaryCard === 'total' && (() => {
                  const onlineCount = data.servers.filter(s => s.status === 'online').length;
                  const offlineCount = data.servers.filter(s => s.status === 'offline').length;
                  const warningCount = data.servers.filter(s => s.status === 'warning').length;
                  const criticalCount = data.servers.filter(s => s.status === 'critical').length;
                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">All Servers ({data.summary.totalServers})</h3>
                      <p className="text-xs text-gray-500 mb-3">Complete inventory across all groups. Click a group or server to drill down.</p>
                      <div className="flex flex-wrap gap-3 mb-4 text-xs">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-gray-400">{onlineCount} online</span></span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-500" /><span className="text-gray-400">{offlineCount} offline</span></span>
                        {warningCount > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-gray-400">{warningCount} warning</span></span>}
                        {criticalCount > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-gray-400">{criticalCount} critical</span></span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {data.summary.groups.map(g => {
                          const groupServers = data.servers.filter(s => s.group_name === g);
                          const groupOnline = groupServers.filter(s => s.status === 'online').length;
                          return (
                            <button
                              key={g}
                              onClick={() => { setFilterGroup(g); setActiveSummaryCard(null); }}
                              className={cn('text-left p-3 rounded-lg border transition-colors', darkMode ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-200 hover:bg-gray-50')}
                            >
                              <span className="text-lg font-bold text-gray-900 dark:text-white">{groupServers.length}</span>
                              <p className="text-xs text-gray-500">{g}</p>
                              <p className="text-xs text-emerald-400 mt-0.5">{groupOnline}/{groupServers.length} online</p>
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-1">
                        {data.servers.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedServer(s.id)}
                            className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors', darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn('w-2 h-2 rounded-full', s.status === 'online' ? 'bg-emerald-400' : s.status === 'critical' ? 'bg-red-500' : s.status === 'warning' ? 'bg-amber-400' : 'bg-gray-500')} />
                              <span className="text-gray-900 dark:text-white font-medium">{s.display_name || s.hostname}</span>
                              <span className="text-gray-500">{s.ip_address}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500">{s.group_name}</span>
                              <span className={cn('px-1.5 py-0.5 rounded text-xs', s.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'critical' ? 'bg-red-500/20 text-red-400' : s.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400')}>{s.status}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {activeSummaryCard === 'online' && (
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-1">Online Servers ({data.summary.onlineServers})</h3>
                    <p className="text-xs text-gray-500 mb-3">Servers actively reporting metrics. Click any server to view details.</p>
                    {data.servers.filter(s => s.status === 'online').length === 0 ? (
                      <p className="text-xs text-gray-400">No servers are currently online.</p>
                    ) : (
                      <div className="space-y-1">
                        {data.servers.filter(s => s.status === 'online').map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedServer(s.id)}
                            className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors', darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span className="text-gray-900 dark:text-white font-medium">{s.display_name || s.hostname}</span>
                              <span className="text-gray-500">{s.ip_address}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-500">
                              {s.metrics && <span>CPU {s.metrics.cpu_percent.toFixed(0)}% · Mem {s.metrics.memory_percent.toFixed(0)}%</span>}
                              <span>{s.group_name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeSummaryCard === 'offline' && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Offline Servers ({data.summary.offlineServers})</h3>
                    <p className="text-xs text-gray-500 mb-3">Servers that have not reported within the stale threshold. Check agent status or network connectivity.</p>
                    {data.servers.filter(s => s.status === 'offline').length === 0 ? (
                      <p className="text-xs text-emerald-400">All servers are online!</p>
                    ) : (
                      <div className="space-y-1">
                        {data.servers.filter(s => s.status === 'offline').map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedServer(s.id)}
                            className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors', darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-500" />
                              <span className="text-gray-900 dark:text-white font-medium">{s.display_name || s.hostname}</span>
                              <span className="text-gray-500">{s.ip_address}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-500">
                              <span>{s.last_seen_at ? `Last seen ${new Date(s.last_seen_at + 'Z').toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Never reported'}</span>
                              <span>{s.group_name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeSummaryCard === 'alerts' && (() => {
                  const alertsByServer: Record<string, typeof data.alerts> = {};
                  data.alerts.forEach(a => {
                    const key = a.server_id;
                    if (!alertsByServer[key]) alertsByServer[key] = [];
                    alertsByServer[key].push(a);
                  });
                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-400 mb-1">Active Alerts ({data.summary.activeAlerts})</h3>
                      <p className="text-xs text-gray-500 mb-3">Unacknowledged alerts grouped by server. Click a server name to view its details.</p>
                      {data.alerts.length === 0 ? (
                        <p className="text-xs text-emerald-400">No active alerts. All systems nominal.</p>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {Object.entries(alertsByServer).map(([serverId, alerts]) => {
                            const server = data.servers.find(s => s.id === serverId);
                            const serverName = server?.display_name || server?.hostname || serverId;
                            return (
                              <div key={serverId} className={cn('rounded-lg border overflow-hidden', darkMode ? 'border-gray-800' : 'border-gray-200')}>
                                <button
                                  onClick={() => setSelectedServer(serverId)}
                                  className={cn('w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors', darkMode ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-gray-50 hover:bg-gray-100')}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={cn('w-2 h-2 rounded-full', alerts.some(a => a.severity === 'critical') ? 'bg-red-500' : 'bg-amber-400')} />
                                    <span className="text-gray-900 dark:text-white">{serverName}</span>
                                    <span className="text-gray-500">{server?.ip_address}</span>
                                  </div>
                                  <span className={cn('px-1.5 py-0.5 rounded', alerts.some(a => a.severity === 'critical') ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>
                                    {alerts.length} alert{alerts.length > 1 ? 's' : ''}
                                  </span>
                                </button>
                                <div className="divide-y divide-gray-800/30">
                                  {alerts.map(a => (
                                    <div key={a.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className={cn('px-1.5 py-0.5 rounded font-medium', a.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>{a.severity}</span>
                                        <span className="text-gray-900 dark:text-white">{a.message}</span>
                                      </div>
                                      <span className="text-gray-600">{a.alert_type}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {activeSummaryCard === 'critical' && (() => {
                  const criticalAlerts = data.alerts.filter(a => a.severity === 'critical');
                  const criticalByServer: Record<string, typeof criticalAlerts> = {};
                  criticalAlerts.forEach(a => {
                    const key = a.server_id;
                    if (!criticalByServer[key]) criticalByServer[key] = [];
                    criticalByServer[key].push(a);
                  });
                  const criticalServerIds = new Set(criticalAlerts.map(a => a.server_id));
                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-red-400 mb-1">Critical Alerts ({data.summary.criticalAlerts})</h3>
                      <p className="text-xs text-gray-500 mb-3">
                        High-severity alerts requiring immediate attention across {criticalServerIds.size} server{criticalServerIds.size !== 1 ? 's' : ''}.
                      </p>
                      {criticalAlerts.length === 0 ? (
                        <p className="text-xs text-emerald-400">No critical alerts. Systems are healthy.</p>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {Object.entries(criticalByServer).map(([serverId, alerts]) => {
                            const server = data.servers.find(s => s.id === serverId);
                            const serverName = server?.display_name || server?.hostname || serverId;
                            return (
                              <div key={serverId} className={cn('rounded-lg border overflow-hidden', darkMode ? 'border-red-500/20' : 'border-red-200')}>
                                <button
                                  onClick={() => setSelectedServer(serverId)}
                                  className={cn('w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors', darkMode ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-red-50 hover:bg-red-100')}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-gray-900 dark:text-white">{serverName}</span>
                                    <span className="text-gray-500">{server?.ip_address}</span>
                                  </div>
                                  <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                                    {alerts.length} critical
                                  </span>
                                </button>
                                <div className="divide-y divide-red-500/10">
                                  {alerts.map(a => (
                                    <div key={a.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-red-400 font-mono">{a.metric_value.toFixed(1)}%</span>
                                        <span className="text-gray-900 dark:text-white">{a.message}</span>
                                      </div>
                                      <span className="text-gray-600">threshold: {a.threshold_value}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {activeSummaryCard === 'notifications' && (
                  <div>
                    <h3 className="text-sm font-semibold text-violet-400 mb-1">Unread Notifications ({data.summary.unreadNotifications})</h3>
                    <p className="text-xs text-gray-500 mb-3">Recent notifications from alert triggers. Each shows the affected server and severity.</p>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-emerald-400">All caught up! No unread notifications.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {notifications.slice(0, 20).map(n => (
                          <div key={n.id} className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs',
                            darkMode
                              ? n.severity === 'critical' ? 'bg-red-500/10' : 'bg-violet-500/10'
                              : n.severity === 'critical' ? 'bg-red-50' : 'bg-violet-50'
                          )}>
                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', n.severity === 'critical' ? 'bg-red-500' : n.severity === 'warning' ? 'bg-amber-400' : 'bg-violet-400')} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {(n.hostname || n.display_name) ? (
                                  <button
                                    onClick={() => n.server_id && setSelectedServer(n.server_id)}
                                    className="font-medium text-gray-900 dark:text-white hover:text-blue-400 transition-colors"
                                  >
                                    {n.display_name || n.hostname}
                                  </button>
                                ) : (
                                  <span className="font-medium text-gray-400">Unknown server</span>
                                )}
                                {n.severity && (
                                  <span className={cn('px-1.5 py-0.5 rounded font-medium', n.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>{n.severity}</span>
                                )}
                                {n.alert_type && (
                                  <span className="text-gray-500">{n.alert_type}</span>
                                )}
                              </div>
                              <p className="text-gray-400 truncate">{n.message}</p>
                              {n.ip_address && <p className="text-gray-600 mt-0.5">{n.ip_address}</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-gray-600">{new Date(n.timestamp + 'Z').toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              <button
                                onClick={() => handleMarkNotificationRead(n.id)}
                                className="text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
                              >
                                Mark read
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search servers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                    darkMode ? 'bg-gray-900 border border-gray-800 text-white placeholder-gray-600' : 'bg-white border border-gray-200 text-gray-900'
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm focus:outline-none',
                    darkMode ? 'bg-gray-900 border border-gray-800 text-white' : 'bg-white border border-gray-200'
                  )}
                >
                  <option value="all">All Groups</option>
                  {data.summary.groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm focus:outline-none',
                    darkMode ? 'bg-gray-900 border border-gray-800 text-white' : 'bg-white border border-gray-200'
                  )}
                >
                  <option value="all">All Status</option>
                  <option value="online">Online</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setShowOverview(!showOverview)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    showOverview ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                  title="Environment Overview"
                >
                  <Map className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    showComparison ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                  title="Server Comparison"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className={cn(
                    'p-2 rounded-lg transition-colors relative',
                    showAlerts ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <Filter className="w-4 h-4" />
                  {data.summary.activeAlerts > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full" />
                  )}
                </button>
              </div>
            </div>

            {/* Environment Overview */}
            {showOverview && data.servers.length > 0 && (
              <EnvironmentOverview
                servers={data.servers}
                onServerClick={(id) => setSelectedServer(id)}
              />
            )}

            {/* Server Comparison */}
            {showComparison && data.servers.length > 0 && (
              <ServerComparison
                servers={data.servers}
                onServerClick={(id) => setSelectedServer(id)}
              />
            )}

            {/* Alerts Panel (collapsible) */}
            {showAlerts && (
              <AlertPanel
                alerts={data.alerts}
                onAcknowledge={handleAcknowledge}
                onClose={() => setShowAlerts(false)}
              />
            )}

            {/* Server Grid/List */}
            {filteredServers.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">No servers found</p>
                <p className="text-gray-600 text-sm mt-2">
                  Register a client agent to start monitoring servers.
                </p>
              </div>
            ) : (
              Object.entries(groupedServers).map(([group, servers]) => (
                <div key={group}>
                  {Object.keys(groupedServers).length > 1 && (
                    <h2 className={cn(
                      'text-sm font-semibold mb-3 flex items-center gap-2',
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {group}
                      <span className="text-xs text-gray-600">({servers.length})</span>
                    </h2>
                  )}

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {servers.map((server) => (
                        <ServerCard
                          key={server.id}
                          server={server}
                          onClick={() => setSelectedServer(server.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={cn(
                      'rounded-xl border overflow-hidden',
                      darkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-gray-200'
                    )}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cn(
                            'border-b text-xs',
                            darkMode ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-400'
                          )}>
                            <th className="text-left p-3">Server</th>
                            <th className="text-left p-3">IP</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-right p-3">CPU</th>
                            <th className="text-right p-3">Memory</th>
                            <th className="text-right p-3">Alerts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {servers.map((server) => (
                            <tr
                              key={server.id}
                              onClick={() => setSelectedServer(server.id)}
                              className={cn(
                                'border-b cursor-pointer transition-colors',
                                darkMode ? 'border-gray-800/50 hover:bg-gray-800/30' : 'border-gray-100 hover:bg-gray-50'
                              )}
                            >
                              <td className="p-3 font-medium">{server.display_name || server.hostname}</td>
                              <td className="p-3 text-gray-400 font-mono">{server.ip_address}</td>
                              <td className="p-3">
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded-full capitalize',
                                  server.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' :
                                  server.status === 'critical' ? 'bg-red-500/20 text-red-400' :
                                  server.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-gray-500/20 text-gray-400'
                                )}>
                                  {server.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono">
                                {server.metrics ? `${server.metrics.cpu_percent.toFixed(1)}%` : '-'}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {server.metrics ? `${server.metrics.memory_percent.toFixed(1)}%` : '-'}
                              </td>
                              <td className="p-3 text-right">
                                {server.alert_count > 0 ? (
                                  <span className="text-amber-400">{server.alert_count}</span>
                                ) : (
                                  <span className="text-gray-600">0</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-500">
            Failed to load dashboard data.
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={cn(
        'border-t py-4 text-center text-xs',
        darkMode ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400'
      )}>
        Server Monitor Dashboard &middot; Auto-refresh: {autoRefresh ? 'ON (30s)' : 'OFF'}
      </footer>
    </div>
  );
}
