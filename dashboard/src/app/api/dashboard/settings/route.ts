import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting, cleanupOldData } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const keys = [
      'alert_email_enabled',
      'alert_email_to',
      'alert_email_smtp_host',
      'alert_email_smtp_port',
      'stale_threshold_minutes',
      'data_retention_days',
      'dashboard_refresh_seconds',
    ];

    const settings: Record<string, string> = {};
    for (const key of keys) {
      settings[key] = getSetting(key) || '';
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const allowedKeys = [
      'alert_email_enabled',
      'alert_email_to',
      'alert_email_smtp_host',
      'alert_email_smtp_port',
      'stale_threshold_minutes',
      'data_retention_days',
      'dashboard_refresh_seconds',
    ];

    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.includes(key) && typeof value === 'string') {
        setSetting(key, value);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const retentionDays = parseInt(getSetting('data_retention_days') || '30');
    cleanupOldData(retentionDays);
    return NextResponse.json({ status: 'ok', message: `Cleaned up data older than ${retentionDays} days` });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
