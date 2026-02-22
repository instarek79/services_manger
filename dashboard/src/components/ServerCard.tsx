'use client';

import { ServerInfo } from '@/lib/types';
import { cn, formatBytes, formatUptime, getStatusBg, getCpuColor, getMemoryColor } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import CircularGauge from './CircularGauge';
import {
  Server,
  Cpu,
  HardDrive,
  Clock,
  AlertTriangle,
  Network,
} from 'lucide-react';

interface ServerCardProps {
  server: ServerInfo;
  onClick: () => void;
}

export default function ServerCard({ server, onClick }: ServerCardProps) {
  const m = server.metrics;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-xl border p-5 cursor-pointer transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/20',
        'bg-white dark:bg-gray-900/80 backdrop-blur-sm shadow-sm dark:shadow-none',
        getStatusBg(server.status)
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'p-2 rounded-lg',
            server.status === 'online' ? 'bg-emerald-500/20' :
            server.status === 'critical' ? 'bg-red-500/20' :
            server.status === 'warning' ? 'bg-amber-500/20' :
            'bg-gray-500/20'
          )}>
            <Server className="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {server.display_name || server.hostname}
            </h3>
            <p className="text-xs text-gray-500 truncate">{server.ip_address}</p>
          </div>
        </div>
        <StatusBadge status={server.status} size="sm" />
      </div>

      {/* Metrics */}
      {m ? (
        <>
          <div className="flex justify-around mb-4">
            <CircularGauge
              value={m.cpu_percent}
              color={getCpuColor(m.cpu_percent)}
              label="CPU"
              size={70}
              strokeWidth={5}
            />
            <CircularGauge
              value={m.memory_percent}
              color={getMemoryColor(m.memory_percent)}
              label="Memory"
              sublabel={`${formatBytes(m.memory_used)} / ${formatBytes(m.memory_total)}`}
              size={70}
              strokeWidth={5}
            />
          </div>

          {/* Disk bars */}
          {m.disks && m.disks.length > 0 && (
            <div className="space-y-2 mb-3">
              {m.disks.slice(0, 3).map((disk, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-400 flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {disk.mountpoint}
                    </span>
                    <span className="text-gray-500">
                      {formatBytes(disk.free)} free
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
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
          )}

          {/* Footer info */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-800">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatUptime(m.uptime_seconds)}
            </span>
            <span className="flex items-center gap-1">
              <Network className="w-3 h-3" />
              {server.os_info?.split(' ')[0] || 'Unknown'}
            </span>
            {server.alert_count > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {server.alert_count}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
          No metrics data yet
        </div>
      )}
    </div>
  );
}
