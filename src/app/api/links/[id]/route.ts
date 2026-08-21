/**
 * Manage a single short link
 *
 * PATCH  /api/links/<id>   Update the mapped /api/sub link and/or the name
 *                          Body: { link?, name? }
 * DELETE /api/links/<id>   Delete the link
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrigin,
  jsonError,
  readJsonBody,
  readString,
  requireStorage,
  requireUser,
  serializeLink,
} from '@/lib/api/helpers';
import { deleteLink, getLink, updateLink } from '@/lib/store/links';
import { parseSubLink, SubParams } from '@/lib/subconvert';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const storageError = requireStorage();
  if (storageError) return storageError;

  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonError('Invalid JSON body', 400);
  }

  const rawLink = readString(body, 'link');
  const name = readString(body, 'name');

  if (rawLink === undefined && name === undefined) {
    return jsonError('Nothing to update', 400);
  }

  let params: SubParams | undefined;
  if (rawLink !== undefined) {
    try {
      params = parseSubLink(rawLink);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : 'Invalid link', 400);
    }
  }

  try {
    const { id } = await context.params;
    const link = await getLink(id);

    if (!link || link.owner !== auth.username) {
      return jsonError('Link not found', 404);
    }

    const updated = await updateLink(link, { params, name });
    return NextResponse.json({ link: serializeLink(updated, getOrigin(request)) });
  } catch (error) {
    console.error('Update link error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonError(`Failed to update link: ${message}`, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    await deleteLink(link);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete link error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonError(`Failed to delete link: ${message}`, 500);
  }
}
