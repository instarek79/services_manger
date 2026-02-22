import { NextRequest, NextResponse } from 'next/server';
import {
  getServer,
  setPendingConfig,
  getPendingConfig,
  getConfigHistory,
} from '@/lib/database';

export const dynamic = 'force-dynamic';

// Dashboard UI fetches current pending config + history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const server = getServer(id);
    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const pending = getPendingConfig(id);
    const history = getConfigHistory(id, 50);

    // Parse config_value JSON in history rows
    const parsedHistory = (history as Array<Record<string, unknown>>).map(h => {
      let value: unknown = h.config_value;
      try { value = JSON.parse(h.config_value as string); } catch { /* keep raw */ }
      return { ...h, config_value: value };
    });

    return NextResponse.json({
      server_id: id,
      pending: pending || {},
      has_pending: !!pending,
      history: parsedHistory,
    });
  } catch (error) {
    console.error('Config fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Dashboard UI pushes config changes for an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const server = getServer(id);
    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const body = await request.json();
    const { config } = body;

    if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
      return NextResponse.json({ error: 'No config provided' }, { status: 400 });
    }

    // Validate allowed config keys
    const allowedKeys = [
      'collection_interval_minutes',
      'top_processes_count',
      'monitored_services',
      'auto_discover_services',
      'live_enabled',
      'live_interval_seconds',
      'live_retention_minutes',
      'collect_processes',
      'collect_disks',
      'collect_network',
      'ping_enabled',
      'log_level',
    ];

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (allowedKeys.includes(key)) {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'No valid config keys provided', allowed_keys: allowedKeys }, { status: 400 });
    }

    setPendingConfig(id, filtered);

    return NextResponse.json({
      status: 'ok',
      message: `Queued ${Object.keys(filtered).length} config change(s). Agent will pick them up on next poll.`,
      queued: filtered,
    });
  } catch (error) {
    console.error('Config push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
