'use client';

import { ServerInfo } from '@/lib/types';
import { formatBytes, filterRealDisks } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface ServerComparisonProps {
  servers: ServerInfo[];
  onServerClick: (id: string) => void;
}

export default function ServerComparison({ servers, onServerClick }: ServerComparisonProps) {
  const serversWithMetrics = servers.filter(s => s.metrics);

  if (serversWithMetrics.length === 0) {
    return null;
  }

  const cpuData = serversWithMetrics.map(s => ({
    name: (s.display_name || s.hostname).slice(0, 14),
    id: s.id,
    value: s.metrics!.cpu_percent,
  })).sort((a, b) => b.value - a.value);

  const memData = serversWithMetrics.map(s => ({
    name: (s.display_name || s.hostname).slice(0, 14),
    id: s.id,
    value: s.metrics!.memory_percent,
    used: s.metrics!.memory_used,
    total: s.metrics!.memory_total,
  })).sort((a, b) => b.value - a.value);

  const diskData = serversWithMetrics
    .filter(s => s.metrics!.disks && filterRealDisks(s.metrics!.disks).length > 0)
    .map(s => {
      const realDisks = filterRealDisks(s.metrics!.disks);
      const worstDisk = realDisks.reduce((worst, d) =>
        d.percent > worst.percent ? d : worst, realDisks[0]);
      return {
        name: (s.display_name || s.hostname).slice(0, 14),
        id: s.id,
        value: worstDisk.percent,
        mountpoint: worstDisk.mountpoint,
      };
    }).sort((a, b) => b.value - a.value);

  const getBarColor = (value: number) => {
    if (value >= 90) return '#ef4444';
    if (value >= 70) return '#f59e0b';
    return '#10b981';
  };

  const getMemBarColor = (value: number) => {
    if (value >= 90) return '#ef4444';
    if (value >= 70) return '#f59e0b';
    return '#3b82f6';
  };

  const getDiskBarColor = (value: number) => {
    if (value >= 90) return '#ef4444';
    if (value >= 70) return '#f59e0b';
    return '#8b5cf6';
  };

  const chartHeight = Math.max(200, serversWithMetrics.length * 32 + 60);

  return (
    <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm dark:shadow-none">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        Server Comparison
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CPU Comparison */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2 text-center">CPU Usage (%)</h4>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cpuData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  stroke="#4b5563"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'CPU']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(data) => {
                    if (data?.id) onServerClick(data.id);
                  }}
                >
                  {cpuData.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Comparison */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2 text-center">Memory Usage (%)</h4>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  stroke="#4b5563"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, _name: any, props: any) => {
                    const p = props?.payload;
                    const detail = p?.used && p?.total
                      ? ` (${formatBytes(p.used)} / ${formatBytes(p.total)})`
                      : '';
                    return [`${Number(value).toFixed(1)}%${detail}`, 'Memory'];
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(data) => {
                    if (data?.id) onServerClick(data.id);
                  }}
                >
                  {memData.map((entry, i) => (
                    <Cell key={i} fill={getMemBarColor(entry.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Disk Comparison */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2 text-center">Disk Usage (worst partition %)</h4>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diskData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#4b5563" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  stroke="#4b5563"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, _name: any, props: any) => {
                    const mp = props?.payload?.mountpoint || '';
                    return [`${Number(value).toFixed(1)}% (${mp})`, 'Disk'];
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(data) => {
                    if (data?.id) onServerClick(data.id);
                  }}
                >
                  {diskData.map((entry, i) => (
                    <Cell key={i} fill={getDiskBarColor(entry.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
