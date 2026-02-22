import { NextRequest, NextResponse } from 'next/server';
import { getActiveAlerts, acknowledgeAlert } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alerts = getActiveAlerts();
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Alerts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_id } = body;
    if (!alert_id) {
      return NextResponse.json({ error: 'alert_id is required' }, { status: 400 });
    }
    acknowledgeAlert(alert_id);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Alert acknowledge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
