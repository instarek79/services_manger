import { NextRequest, NextResponse } from 'next/server';
import { getAllServers, getLatestMetrics, getMetricsHistory, getActiveAlerts } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';
    const hours = parseInt(searchParams.get('hours') || '24');

    const servers = getAllServers() as Record<string, unknown>[];
    const alerts = getActiveAlerts() as Record<string, unknown>[];

    const exportData = servers.map((server) => {
      const metrics = getLatestMetrics(server.id as string) as Record<string, unknown> | undefined;
      const history = getMetricsHistory(server.id as string, hours) as Record<string, unknown>[];

      let diskInfo: unknown[] = [];
      if (metrics?.disk_info) {
        try { diskInfo = JSON.parse(metrics.disk_info as string); } catch { /* ignore */ }
      }

      return {
        server: {
          id: server.id,
          hostname: server.hostname,
          ip_address: server.ip_address,
          os_info: server.os_info,
          group_name: server.group_name,
          display_name: server.display_name,
          registered_at: server.registered_at,
          last_seen_at: server.last_seen_at,
        },
        current_metrics: metrics ? {
          cpu_percent: metrics.cpu_percent,
          memory_percent: metrics.memory_percent,
          memory_total: metrics.memory_total,
          memory_used: metrics.memory_used,
          memory_free: metrics.memory_free,
          disks: diskInfo,
          uptime_seconds: metrics.uptime_seconds,
          timestamp: metrics.timestamp,
        } : null,
        history: history.map(h => ({
          timestamp: h.timestamp,
          cpu_percent: h.cpu_percent,
          memory_percent: h.memory_percent,
        })),
        alerts: alerts.filter(a => a.server_id === server.id),
      };
    });

    if (format === 'csv') {
      const csvLines = ['hostname,ip_address,os_info,group,cpu_percent,memory_percent,status,last_seen'];
      for (const entry of exportData) {
        const s = entry.server;
        const m = entry.current_metrics;
        csvLines.push([
          s.hostname,
          s.ip_address,
          `"${s.os_info}"`,
          s.group_name,
          m?.cpu_percent?.toString() || '',
          m?.memory_percent?.toString() || '',
          s.last_seen_at ? 'online' : 'offline',
          s.last_seen_at || '',
        ].join(','));
      }

      return new NextResponse(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="server-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      period_hours: hours,
      total_servers: exportData.length,
      data: exportData,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
