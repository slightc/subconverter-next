/**
 * Subscription converter API route
 *
 * GET /api/sub
 *
 * Query parameters:
 * - url: Subscription URL (required, multiple URLs separated by |)
 * - target: Target format - clash, clashr, mixed (required)
 * - config: Remote config URL (optional, enables full config generation)
 * - include: Include nodes matching regex
 * - exclude: Exclude nodes matching regex
 * - filename: Download filename
 * - append_type: Append proxy type to node name
 * - udp: Enable UDP
 * - tfo: Enable TCP Fast Open
 * - scv: Skip certificate verify
 * - insert: Insert custom nodes (not implemented yet)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SUPPORTED_TARGETS,
  convertSubscription,
  getContentType,
  pickSubParams,
  TargetFormat,
} from '@/lib/subconvert';

export async function GET(request: NextRequest) {
  const params = pickSubParams(request.nextUrl.searchParams);

  return convertSubscription(params, {
    userAgent: request.headers.get('user-agent') || undefined,
  });
}

// Also support HEAD requests for subscription checks
export async function HEAD(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const target = searchParams.get('target');

  if (!url || !target || !SUPPORTED_TARGETS.includes(target)) {
    return new NextResponse(null, { status: 400 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': getContentType(target as TargetFormat),
    },
  });
}
