'use client';

import { AlertInfo } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { AlertTriangle, AlertOctagon, CheckCircle, X } from 'lucide-react';

interface AlertPanelProps {
  alerts: AlertInfo[];
  onAcknowledge: (alertId: number) => void;
  onClose?: () => void;
  title?: string;
}

export default function AlertPanel({ alerts, onAcknowledge, onClose, title = 'Active Alerts' }: AlertPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          {title} ({alerts.length})
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-gray-600 text-sm">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
            No active alerts
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                {alert.severity === 'critical' ? (
                  <AlertOctagon className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 dark:text-white">{alert.message}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {alert.display_name || alert.hostname} &middot; {timeAgo(alert.timestamp)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge(alert.id);
                  }}
                  className="text-xs text-gray-500 hover:text-emerald-400 transition-colors shrink-0"
                  title="Acknowledge"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
