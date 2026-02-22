'use client';

import { useState, useRef, useEffect } from 'react';
import { NotificationInfo } from '@/lib/types';
import { Bell, CheckCheck, X } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface NotificationBellProps {
  notifications: NotificationInfo[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}

export default function NotificationBell({ notifications, onMarkRead, onMarkAllRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-xs text-gray-500 hover:text-emerald-400 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-sm">
                No new notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3 border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors flex items-start gap-2"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${n.severity === 'critical' ? 'bg-red-500' : n.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <div className="flex-1 min-w-0">
                    {(n.hostname || n.display_name) && (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-semibold text-gray-900 dark:text-white">{n.display_name || n.hostname}</span>
                        {n.severity && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${n.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{n.severity}</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-700 dark:text-gray-300">{n.message}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(n.timestamp)}</p>
                  </div>
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="text-gray-600 hover:text-emerald-400 shrink-0"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
