'use client';

import { useState, useEffect, useRef } from 'react';
import { LiveMetricsData, LiveMetricsSnapshot, LiveBenchmark } from '@/lib/types';
import { formatBytes, cn } from '@/lib/utils';
import {
  Cpu,
  MemoryStick,
  Network,
  HardDrive,
  Activity,
  Gauge,
  BarChart3,
  Zap,
  RefreshCw,
  Pause,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface PerformanceMonitorProps {
  serverId: string;
}

export default function PerformanceMonitor({ serverId }: PerformanceMonitorProps) {
  const [data, setData] = useState<LiveMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [viewMinutes, setViewMinutes] = useState(5);
  const [benchmarkMinutes, setBenchmarkMinutes] = useState(30);
  const [activeSection, setActiveSection] = useState<'live' | 'benchmark'>('live');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/dashboard/server/${serverId}/live?minutes=${viewMinutes}&benchmark=${benchmarkMinutes}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch live metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (!paused) {
      intervalRef.current = setInterval(fetchData, refreshInterval * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [serverId, paused, refreshInterval, viewMinutes, benchmarkMinutes]);

  const latest: LiveMetricsSnapshot | null =
    data?.metrics && data.metrics.length > 0 ? data.metrics[data.metrics.length - 1] : null;

  const benchmark = data?.benchmark || null;

  // Prepare chart data
  const chartData = (data?.metrics || []).map((m) => ({
    time: new Date(m.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    cpu: m.cpu_percent,
    memory: m.memory_percent,
    swap: m.swap_percent,
    netSend: m.network_rate?.bytes_sent_per_sec || 0,
    netRecv: m.network_rate?.bytes_recv_per_sec || 0,
    diskRead: m.disk_io_rate?.read_bytes_per_sec || 0,
    diskWrite: m.disk_io_rate?.write_bytes_per_sec || 0,
    processes: m.process_count,
    threads: m.thread_count,
  }));

  // Per-core data for latest snapshot
  const coreData = (latest?.cpu_per_core || []).map((val, i) => ({
    name: `C${i}`,
    value: val,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (!data || data.metrics.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center shadow-sm dark:shadow-none">
        <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Live Data Available</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Enable live performance collection in the agent config by setting{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">&quot;live_enabled&quot;: true</code>{' '}
          and configure the interval with{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">&quot;live_interval_seconds&quot;: 10</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection('live')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeSection === 'live'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Monitor
          </button>
          <button
            onClick={() => setActiveSection('benchmark')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeSection === 'benchmark'
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Benchmark
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === 'live' && (
            <>
              <span className="text-xs text-gray-500">Window:</span>
              {[1, 2, 5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMinutes(m)}
                  className={cn(
                    'px-2 py-1 text-xs rounded',
                    viewMinutes === m ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {m}m
                </button>
              ))}
            </>
          )}
          {activeSection === 'benchmark' && (
            <>
              <span className="text-xs text-gray-500">Period:</span>
              {[5, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setBenchmarkMinutes(m)}
                  className={cn(
                    'px-2 py-1 text-xs rounded',
                    benchmarkMinutes === m ? 'bg-violet-500/20 text-violet-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {m}m
                </button>
              ))}
            </>
          )}
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <span className="text-xs text-gray-500">Refresh:</span>
          {[2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setRefreshInterval(s)}
              className={cn(
                'px-2 py-1 text-xs rounded',
                refreshInterval === s ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {s}s
            </button>
          ))}
          <button
            onClick={() => setPaused(!paused)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              paused ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-400 hover:text-gray-300'
            )}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', paused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse')} />
            <span className="text-xs text-gray-500">{data.metrics.length} samples</span>
          </div>
        </div>
      </div>

      {/* Live Monitor Section */}
      {activeSection === 'live' && (
        <div className="space-y-4">
          {/* Real-time Stats Cards */}
          {latest && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatCard
                icon={<Cpu className="w-4 h-4" />}
                label="CPU"
                value={`${latest.cpu_percent.toFixed(1)}%`}
                color={latest.cpu_percent >= 90 ? 'red' : latest.cpu_percent >= 70 ? 'amber' : 'emerald'}
              />
              <StatCard
                icon={<MemoryStick className="w-4 h-4" />}
                label="Memory"
                value={`${latest.memory_percent.toFixed(1)}%`}
                sublabel={formatBytes(latest.memory_used)}
                color={latest.memory_percent >= 90 ? 'red' : latest.memory_percent >= 70 ? 'amber' : 'blue'}
              />
              <StatCard
                icon={<Gauge className="w-4 h-4" />}
                label="Swap"
                value={`${latest.swap_percent.toFixed(1)}%`}
                sublabel={formatBytes(latest.swap_used)}
                color={latest.swap_percent >= 50 ? 'amber' : 'gray'}
              />
              <StatCard
                icon={<Network className="w-4 h-4" />}
                label="Net Send"
                value={formatBytesRate(latest.network_rate?.bytes_sent_per_sec || 0)}
                color="violet"
              />
              <StatCard
                icon={<Network className="w-4 h-4" />}
                label="Net Recv"
                value={formatBytesRate(latest.network_rate?.bytes_recv_per_sec || 0)}
                color="cyan"
              />
              <StatCard
                icon={<HardDrive className="w-4 h-4" />}
                label="Disk I/O"
                value={formatBytesRate((latest.disk_io_rate?.read_bytes_per_sec || 0) + (latest.disk_io_rate?.write_bytes_per_sec || 0))}
                sublabel={`R: ${formatBytesRate(latest.disk_io_rate?.read_bytes_per_sec || 0)} W: ${formatBytesRate(latest.disk_io_rate?.write_bytes_per_sec || 0)}`}
                color="orange"
              />
            </div>
          )}

          {/* Counters Row */}
          {latest && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              <MiniStat label="Processes" value={latest.process_count} />
              <MiniStat label="Threads" value={latest.thread_count} />
              <MiniStat label="CPU Freq" value={`${latest.cpu_freq_mhz} MHz`} />
              {latest.handle_count > 0 && <MiniStat label="Handles" value={latest.handle_count} />}
            </div>
          )}

          {/* CPU & Memory Chart */}
          {chartData.length > 1 && (
            <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                CPU &amp; Memory (Live)
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="liveCpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="liveMemGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="liveSwapGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                      formatter={((value: number | string | undefined) => [`${Number(value ?? 0).toFixed(1)}%`]) as never}
                    />
                    <Area type="monotone" dataKey="cpu" stroke="#10b981" fill="url(#liveCpuGrad)" name="CPU" strokeWidth={2} />
                    <Area type="monotone" dataKey="memory" stroke="#3b82f6" fill="url(#liveMemGrad)" name="Memory" strokeWidth={2} />
                    <Area type="monotone" dataKey="swap" stroke="#f59e0b" fill="url(#liveSwapGrad)" name="Swap" strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Network & Disk I/O Chart */}
          {chartData.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Network className="w-4 h-4 text-violet-400" />
                  Network Rate
                </h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="netSendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="netRecvGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 9 }} />
                      <YAxis stroke="#4b5563" tick={{ fontSize: 9 }} tickFormatter={(v) => formatBytesRate(v)} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                        formatter={((value: number | string | undefined) => [formatBytesRate(Number(value ?? 0))]) as never}
                      />
                      <Area type="monotone" dataKey="netSend" stroke="#8b5cf6" fill="url(#netSendGrad)" name="Sent" strokeWidth={2} />
                      <Area type="monotone" dataKey="netRecv" stroke="#06b6d4" fill="url(#netRecvGrad)" name="Received" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-orange-400" />
                  Disk I/O Rate
                </h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="diskReadGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="diskWriteGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 9 }} />
                      <YAxis stroke="#4b5563" tick={{ fontSize: 9 }} tickFormatter={(v) => formatBytesRate(v)} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                        formatter={((value: number | string | undefined) => [formatBytesRate(Number(value ?? 0))]) as never}
                      />
                      <Area type="monotone" dataKey="diskRead" stroke="#f97316" fill="url(#diskReadGrad)" name="Read" strokeWidth={2} />
                      <Area type="monotone" dataKey="diskWrite" stroke="#ec4899" fill="url(#diskWriteGrad)" name="Write" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Per-Core CPU Usage */}
          {coreData.length > 0 && (
            <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Per-Core CPU Usage
              </h3>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coreData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#4b5563" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                      formatter={((value: number | string | undefined) => [`${Number(value ?? 0).toFixed(1)}%`]) as never}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {coreData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.value >= 90 ? '#ef4444' : entry.value >= 70 ? '#f59e0b' : '#10b981'}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Benchmark Section */}
      {activeSection === 'benchmark' && (
        <div className="space-y-4">
          {benchmark && benchmark.sample_count > 0 ? (
            <>
              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-400" />
                    Performance Benchmark
                  </h3>
                  <span className="text-xs text-gray-500">
                    {benchmark.sample_count} samples over {benchmarkMinutes}m
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <BenchmarkCard
                    title="CPU Usage"
                    icon={<Cpu className="w-4 h-4 text-emerald-400" />}
                    min={benchmark.cpu_min}
                    max={benchmark.cpu_max}
                    avg={benchmark.cpu_avg}
                    unit="%"
                    colorFn={(v) => v >= 90 ? 'text-red-400' : v >= 70 ? 'text-amber-400' : 'text-emerald-400'}
                  />
                  <BenchmarkCard
                    title="Memory Usage"
                    icon={<MemoryStick className="w-4 h-4 text-blue-400" />}
                    min={benchmark.mem_min}
                    max={benchmark.mem_max}
                    avg={benchmark.mem_avg}
                    unit="%"
                    colorFn={(v) => v >= 90 ? 'text-red-400' : v >= 70 ? 'text-amber-400' : 'text-blue-400'}
                  />
                  <BenchmarkCard
                    title="Swap Usage"
                    icon={<Gauge className="w-4 h-4 text-amber-400" />}
                    min={benchmark.swap_min}
                    max={benchmark.swap_max}
                    avg={benchmark.swap_avg}
                    unit="%"
                    colorFn={(v) => v >= 50 ? 'text-amber-400' : 'text-gray-400'}
                  />
                  <BenchmarkCard
                    title="Processes"
                    icon={<Activity className="w-4 h-4 text-cyan-400" />}
                    min={benchmark.proc_min}
                    max={benchmark.proc_max}
                    avg={benchmark.proc_avg}
                    unit=""
                    isInteger
                    colorFn={() => 'text-cyan-400'}
                  />
                  <BenchmarkCard
                    title="Threads"
                    icon={<Zap className="w-4 h-4 text-violet-400" />}
                    min={benchmark.thread_min}
                    max={benchmark.thread_max}
                    avg={benchmark.thread_avg}
                    unit=""
                    isInteger
                    colorFn={() => 'text-violet-400'}
                  />
                </div>
              </div>

              {/* Benchmark Comparison Bars */}
              <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm dark:shadow-none">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Range Overview
                </h3>
                <div className="space-y-4">
                  <RangeBar label="CPU" min={benchmark.cpu_min} max={benchmark.cpu_max} avg={benchmark.cpu_avg} maxScale={100} color="emerald" />
                  <RangeBar label="Memory" min={benchmark.mem_min} max={benchmark.mem_max} avg={benchmark.mem_avg} maxScale={100} color="blue" />
                  <RangeBar label="Swap" min={benchmark.swap_min} max={benchmark.swap_max} avg={benchmark.swap_avg} maxScale={100} color="amber" />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center shadow-sm dark:shadow-none">
              <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Benchmark Data</h3>
              <p className="text-sm text-gray-500">
                Benchmark data will appear once live metrics have been collected for the selected period.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper components

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    red: 'border-red-500/30 bg-red-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    violet: 'border-violet-500/30 bg-violet-500/5',
    cyan: 'border-cyan-500/30 bg-cyan-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
    gray: 'border-gray-500/30 bg-gray-500/5',
  };
  const textColorMap: Record<string, string> = {
    red: 'text-red-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
    orange: 'text-orange-400',
    gray: 'text-gray-400',
  };

  return (
    <div className={cn('border rounded-xl p-3 shadow-sm dark:shadow-none', colorMap[color] || colorMap.gray)}>
      <div className={cn('flex items-center gap-1.5 mb-1', textColorMap[color] || textColorMap.gray)}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={cn('text-lg font-bold', textColorMap[color] || textColorMap.gray)}>{value}</div>
      {sublabel && <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 shadow-sm dark:shadow-none">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

function BenchmarkCard({
  title,
  icon,
  min,
  max,
  avg,
  unit,
  isInteger,
  colorFn,
}: {
  title: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  avg: number;
  unit: string;
  isInteger?: boolean;
  colorFn: (v: number) => string;
}) {
  const fmt = (v: number) => isInteger ? Math.round(v).toLocaleString() : v.toFixed(1);

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-gray-500 mb-0.5 flex items-center justify-center gap-1">
            <TrendingDown className="w-3 h-3" /> Min
          </div>
          <div className={cn('text-sm font-bold', colorFn(min))}>
            {fmt(min)}{unit}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5 flex items-center justify-center gap-1">
            <Minus className="w-3 h-3" /> Avg
          </div>
          <div className={cn('text-sm font-bold', colorFn(avg))}>
            {fmt(avg)}{unit}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" /> Max
          </div>
          <div className={cn('text-sm font-bold', colorFn(max))}>
            {fmt(max)}{unit}
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeBar({
  label,
  min,
  max,
  avg,
  maxScale,
  color,
}: {
  label: string;
  min: number;
  max: number;
  avg: number;
  maxScale: number;
  color: string;
}) {
  const minPct = (min / maxScale) * 100;
  const maxPct = (max / maxScale) * 100;
  const avgPct = (avg / maxScale) * 100;

  const bgMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500">
          {min.toFixed(1)}% — {avg.toFixed(1)}% — {max.toFixed(1)}%
        </span>
      </div>
      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        {/* Range bar from min to max */}
        <div
          className={cn('absolute h-full rounded-full opacity-40', bgMap[color] || 'bg-gray-500')}
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        {/* Average marker */}
        <div
          className={cn('absolute h-full w-1 rounded-full', bgMap[color] || 'bg-gray-500')}
          style={{ left: `${avgPct}%` }}
        />
      </div>
    </div>
  );
}

function formatBytesRate(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(Math.abs(bytesPerSec)) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return parseFloat((bytesPerSec / Math.pow(k, idx)).toFixed(1)) + ' ' + sizes[idx];
}
