/**
 * Current session info
 *
 * GET /api/auth/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getKVStore } from '@/lib/storage/kv';

export async function GET(request: NextRequest) {
  const storageConfigured = getKVStore().isConfigured();
  const registerEnabled = process.env.DISABLE_REGISTER !== 'true';
  const inviteRequired = Boolean(process.env.REGISTER_CODE);

  let username: string | null = null;
  if (storageConfigured) {
    try {
      username = getSessionUser(request);
    } catch {
      // AUTH_SECRET missing — treat as signed out.
      username = null;
    }
  }

  return NextResponse.json({
    username,
    storageConfigured,
    registerEnabled,
    inviteRequired,
  });
}
