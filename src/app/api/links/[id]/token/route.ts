/**
 * Rotate the token of a short link
 *
 * POST /api/links/<id>/token
 *
 * The previous subscription URL stops working immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrigin,
  jsonError,
  requireStorage,
  requireUser,
  serializeLink,
} from '@/lib/api/helpers';
import { getLink, rotateLinkToken } from '@/lib/store/links';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const storageError = requireStorage();
  if (storageError) return storageError;

  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const link = await getLink(id);

    if (!link || link.owner !== auth.username) {
      return jsonError('Link not found', 404);
    }

    const rotated = await rotateLinkToken(link);
    return NextResponse.json({ link: serializeLink(rotated, getOrigin(request)) });
  } catch (error) {
    console.error('Rotate token error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonError(`Failed to rotate token: ${message}`, 500);
  }
}
