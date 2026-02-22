import { NextRequest, NextResponse } from 'next/server';
import { registerServer } from '@/lib/database';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }

    const body = await request.json();
    const { hostname, ip_address, os_info } = body;

    if (!hostname) {
      return NextResponse.json({ error: 'hostname is required' }, { status: 400 });
    }

    const { id, apiKey } = registerServer(hostname, ip_address || '', os_info || '');

    return NextResponse.json({
      server_id: id,
      api_key: apiKey,
      message: 'Server registered successfully. Store the api_key securely — it cannot be retrieved again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
