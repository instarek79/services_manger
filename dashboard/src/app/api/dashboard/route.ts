import { NextResponse } from 'next/server';
import { getDashboardSummary, getAllServers, getLatestMetrics, getActiveAlerts } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = getDashboardSummary();
    const servers = getAllServers() as Record<string, unknown>[];
    const alerts = getActiveAlerts() as Record<string, unknown>[];

    const serversWithMetrics = servers.map((server) => {
      const metrics = getLatestMetrics(server.id as string) as Record<string, unknown> | undefined;
      const serverAlerts = alerts.filter(a => a.server_id === server.id);

      let status: 'online' | 'warning' | 'critical' | 'offline' = 'offline';
      if (server.last_seen_at) {
        const lastSeen = new Date(server.last_seen_at as string).getTime();
        const now = Date.now();
        const diffMinutes = (now - lastSeen) / 60000;
        if (diffMinutes < 60) {
          status = 'online';
          if (serverAlerts.some(a => a.severity === 'critical')) {
            status = 'critical';
          } else if (serverAlerts.length > 0) {
            status = 'warning';
          }
        }
      }

      let diskInfo: unknown[] = [];
      if (metrics?.disk_info) {
        try { diskInfo = JSON.parse(metrics.disk_info as string); } catch { /* ignore */ }
      }

      let networkInfo = {};
      if (metrics?.network_info) {
        try { networkInfo = JSON.parse(metrics.network_info as string); } catch { /* ignore */ }
      }

      return {
        ...server,
        status,
        metrics: metrics ? {
          cpu_percent: metrics.cpu_percent,
          memory_total: metrics.memory_total,
          memory_used: metrics.memory_used,
          memory_free: metrics.memory_free,
          memory_percent: metrics.memory_percent,
          disks: diskInfo,
          network: networkInfo,
          uptime_seconds: metrics.uptime_seconds,
          boot_time: metrics.boot_time,
          timestamp: metrics.timestamp,
        } : null,
        alert_count: serverAlerts.length,
        critical_count: serverAlerts.filter(a => a.severity === 'critical').length,
      };
    });

    return NextResponse.json({
      summary,
      servers: serversWithMetrics,
      alerts: alerts.slice(0, 20),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
