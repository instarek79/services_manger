import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/database';

export function authenticateRequest(request: NextRequest): { serverId: string } | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  // Token format: server_id:api_key
  const separatorIndex = token.indexOf(':');
  if (separatorIndex === -1) return null;

  const serverId = token.substring(0, separatorIndex);
  const apiKey = token.substring(separatorIndex + 1);

  if (!serverId || !apiKey) return null;

  if (validateApiKey(serverId, apiKey)) {
    return { serverId };
  }

  return null;
}
