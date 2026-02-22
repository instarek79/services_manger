import { NextRequest, NextResponse } from 'next/server';
import { getUnreadNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const notifications = getUnreadNotifications();
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_id, mark_all } = body;

    if (mark_all) {
      markAllNotificationsRead();
    } else if (notification_id) {
      markNotificationRead(notification_id);
    } else {
      return NextResponse.json({ error: 'notification_id or mark_all required' }, { status: 400 });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Notification update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
