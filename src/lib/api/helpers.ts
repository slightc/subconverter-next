/**
 * Small helpers shared by the account / short link API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKVStore } from '@/lib/storage/kv';
import { getSessionUser } from '@/lib/auth/session';
import { LinkRecord } from '@/lib/store/links';
import { subParamsToQuery } from '@/lib/subconvert';

/** JSON error response */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Parse a JSON request body, returning null when it is not valid JSON */
export async function readJsonBody(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Read a string field from a JSON body */
export function readString(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Ensure the storage backend is available.
 * Returns an error response when it is not configured.
 */
export function requireStorage(): NextResponse | null {
  if (!getKVStore().isConfigured()) {
    return jsonError(
      'Storage is not configured. Connect a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.',
      503
    );
  }
  return null;
}

/**
 * Resolve the logged-in user, or return a 401 response.
 */
export function requireUser(
  request: NextRequest
): { username: string } | NextResponse {
  const username = getSessionUser(request);
  if (!username) {
    return jsonError('Not signed in', 401);
  }
  return { username };
}

/** Public representation of a link, including its ready-to-use URLs */
export function serializeLink(link: LinkRecord, origin: string) {
  const query = subParamsToQuery(link.params);
  return {
    id: link.id,
    name: link.name,
    token: link.token,
    params: link.params,
    /** The /api/sub link this short id maps to */
    link: `${origin}/api/sub?${query}`,
    /** The short subscription URL handed to clients */
    url: `${origin}/api/s/${link.id}?token=${link.token}`,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    tokenRotatedAt: link.tokenRotatedAt,
  };
}

/** Origin of the current request (honours proxy headers on Vercel) */
export function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return request.nextUrl.origin;
  const proto =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
}
