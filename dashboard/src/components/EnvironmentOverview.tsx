'use client';

import { ServerInfo } from '@/lib/types';
import { cn, getStatusDot, formatBytes } from '@/lib/utils';
import {
  Server,
  Database,
  Globe,
  HardDrive,
  Cpu,
  MemoryStick,
  Layers,
} from 'lucide-react';

interface EnvironmentOverviewProps {
  servers: ServerInfo[];
  onServerClick: (id: string) => void;
}

const GROUP_ICONS: Record<string, typeof Server> = {
  'Web Servers': Globe,
  'Database Servers': Database,
  'Application Servers': Layers,
  'Storage': HardDrive,
  'Infrastructure': Cpu,
};

const GROUP_COLORS: Record<string, string> = {
  'Web Servers': 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  'Database Servers': 'from-violet-500/20 to-violet-600/5 border-violet-500/30',
  'Application Servers': 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
  'Storage': 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
  'Infrastructure': 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
};

const GROUP_ICON_COLORS: Record<string, string> = {
  'Web Servers': 'text-blue-400',
  'Database Servers': 'text-violet-400',
  'Application Servers': 'text-emerald-400',
  'Storage': 'text-amber-400',
  'Infrastructure': 'text-cyan-400',
};

export default function EnvironmentOverview({ servers, onServerClick }: EnvironmentOverviewProps) {
  // Group servers
  const groups: Record<string, ServerInfo[]> = {};
  servers.forEach((s) => {
    const g = s.group_name || 'Default';
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });

  // Overall stats
  const totalCpu = servers.filter(s => s.metrics).reduce((sum, s) => sum + (s.metrics?.cpu_percent || 0), 0);
  const avgCpu = servers.filter(s => s.metrics).length > 0
    ? totalCpu / servers.filter(s => s.metrics).length
    : 0;

  const totalMemUsed = servers.filter(s => s.metrics).reduce((sum, s) => sum + (s.metrics?.memory_used || 0), 0);
  const totalMemTotal = servers.filter(s => s.metrics).reduce((sum, s) => sum + (s.metrics?.memory_total || 0), 0);

  const onlineCount = servers.filter(s => s.status === 'online' || s.status === 'warning' || s.status === 'critical').length;
  const criticalCount = servers.filter(s => s.status === 'critical').length;
  const warningCount = servers.filter(s => s.status === 'warning').length;

  return (
    <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          Environment Overview
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-gray-400">Avg CPU:</span>
            <span className="text-gray-900 dark:text-white font-medium">{avgCpu.toFixed(1)}%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MemoryStick className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-gray-400">Total Mem:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {formatBytes(totalMemUsed)} / {formatBytes(totalMemTotal)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-400">{onlineCount} online</span>
          </span>
          {criticalCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400">{criticalCount} critical</span>
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-amber-400">{warningCount} warning</span>
            </span>
          )}
        </div>
      </div>

      {/* Group topology */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(groups).map(([groupName, groupServers]) => {
          const Icon = GROUP_ICONS[groupName] || Server;
          const colorClass = GROUP_COLORS[groupName] || 'from-gray-500/20 to-gray-600/5 border-gray-500/30';
          const iconColor = GROUP_ICON_COLORS[groupName] || 'text-gray-400';

          const groupOnline = groupServers.filter(
            s => s.status === 'online' || s.status === 'warning' || s.status === 'critical'
          ).length;

          return (
            <div
              key={groupName}
              className={cn(
                'rounded-lg border bg-gradient-to-br p-4',
                colorClass
              )}
            >
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn('w-4 h-4', iconColor)} />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{groupName}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {groupOnline}/{groupServers.length} online
                </span>
              </div>

              {/* Server nodes */}
              <div className="space-y-2">
                {groupServers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => onServerClick(server.id)}
                    className="flex items-center gap-2.5 p-2 rounded-md bg-white/60 dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-800/80 cursor-pointer transition-colors group"
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0', getStatusDot(server.status))} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        {server.display_name || server.hostname}
                      </p>
                      <p className="text-[10px] text-gray-600 truncate">{server.ip_address}</p>
                    </div>
                    {server.metrics && (
                      <div className="flex items-center gap-2 text-[10px] shrink-0">
                        <span className={cn(
                          'font-mono',
                          server.metrics.cpu_percent >= 80 ? 'text-red-400' :
                          server.metrics.cpu_percent >= 60 ? 'text-amber-400' :
                          'text-gray-500'
                        )}>
                          {server.metrics.cpu_percent.toFixed(0)}%
                        </span>
                        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              server.metrics.cpu_percent >= 80 ? 'bg-red-500' :
                              server.metrics.cpu_percent >= 60 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            )}
                            style={{ width: `${server.metrics.cpu_percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
