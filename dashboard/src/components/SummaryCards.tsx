'use client';

import { DashboardSummary } from '@/lib/types';
import {
  Server,
  ServerCrash,
  AlertTriangle,
  AlertOctagon,
  Bell,
  Wifi,
} from 'lucide-react';

export type SummaryCardType = 'total' | 'online' | 'offline' | 'alerts' | 'critical' | 'notifications';

interface SummaryCardsProps {
  summary: DashboardSummary;
  onCardClick?: (cardType: SummaryCardType) => void;
  activeCard?: SummaryCardType | null;
}

export default function SummaryCards({ summary, onCardClick, activeCard }: SummaryCardsProps) {
  const cards: { id: SummaryCardType; label: string; value: number; icon: typeof Server; color: string; bg: string; ring: string }[] = [
    {
      id: 'total',
      label: 'Total Servers',
      value: summary.totalServers,
      icon: Server,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      ring: 'ring-blue-500/40',
    },
    {
      id: 'online',
      label: 'Online',
      value: summary.onlineServers,
      icon: Wifi,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'ring-emerald-500/40',
    },
    {
      id: 'offline',
      label: 'Offline',
      value: summary.offlineServers,
      icon: ServerCrash,
      color: 'text-gray-400',
      bg: 'bg-gray-500/10',
      ring: 'ring-gray-500/40',
    },
    {
      id: 'alerts',
      label: 'Active Alerts',
      value: summary.activeAlerts,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      ring: 'ring-amber-500/40',
    },
    {
      id: 'critical',
      label: 'Critical',
      value: summary.criticalAlerts,
      icon: AlertOctagon,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      ring: 'ring-red-500/40',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      value: summary.unreadNotifications,
      icon: Bell,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      ring: 'ring-violet-500/40',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          onClick={() => onCardClick?.(card.id)}
          className={`bg-white dark:bg-gray-900/80 backdrop-blur-sm border rounded-xl p-4 flex items-center gap-3 shadow-sm dark:shadow-none transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md ${
            activeCard === card.id
              ? `border-transparent ring-2 ${card.ring}`
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
          }`}
        >
          <div className={`p-2.5 rounded-lg ${card.bg}`}>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-xs text-gray-500">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
