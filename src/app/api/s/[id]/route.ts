/**
 * Short subscription link
 *
 * GET /api/s/<id>?token=<token>
 *
 * Resolves the short id to the /api/sub parameters its owner configured and
 * runs the regular conversion pipeline. The token is required and can be
 * rotated by the owner at any time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/auth/crypto';
import { getKVStore } from '@/lib/storage/kv';
import { getLink } from '@/lib/store/links';
import { convertSubscription, getContentType, TargetFormat } from '@/lib/subconvert';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const resolved = await resolveLink(request, context);
  if (resolved instanceof NextResponse) return resolved;

  return convertSubscription(resolved.params, {
    userAgent: request.headers.get('user-agent') || undefined,
  });
}

// Clients often probe the subscription URL with HEAD before downloading.
export async function HEAD(request: NextRequest, context: RouteContext) {
  const resolved = await resolveLink(request, context);
  if (resolved instanceof NextResponse) {
    return new NextResponse(null, { status: resolved.status });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': getContentType(resolved.params.target as TargetFormat),
    },
  });
}

/**
 * Look up the link and check the token.
 * Returns an error response when the link is missing or the token is wrong.
 */
async function resolveLink(request: NextRequest, context: RouteContext) {
  if (!getKVStore().isConfigured()) {
    return NextResponse.json(
      {
        error:
          'Storage is not configured. Connect a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.',
      },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  let link;
  try {
    link = await getLink(id);
  } catch (error) {
    console.error('Short link lookup error:', error);
    return NextResponse.json({ error: 'Failed to resolve link' }, { status: 500 });
  }

  // Same response for an unknown id and a wrong token so ids cannot be probed.
  if (!link || !safeEqual(token, link.token)) {
    return NextResponse.json({ error: 'Invalid link or token' }, { status: 404 });
  }

  return link;
}
