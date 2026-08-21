/**
 * Short subscription links of the signed-in user
 *
 * GET  /api/links          List all links
 * POST /api/links          Create a link
 *                          Body: { id, link, name? }
 *                          `link` must be one of this service's own
 *                          /api/sub links (or its query string).
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
import { createLink, listUserLinks, validateLinkId } from '@/lib/store/links';
import { parseSubLink } from '@/lib/subconvert';

export async function GET(request: NextRequest) {
  const storageError = requireStorage();
  if (storageError) return storageError;

  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const links = await listUserLinks(auth.username);
    const origin = getOrigin(request);
    return NextResponse.json({
      links: links.map((link) => serializeLink(link, origin)),
    });
  } catch (error) {
    console.error('List links error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonError(`Failed to list links: ${message}`, 500);
  }
}

export async function POST(request: NextRequest) {
  const storageError = requireStorage();
  if (storageError) return storageError;

  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonError('Invalid JSON body', 400);
  }

  const id = readString(body, 'id') || '';
  const link = readString(body, 'link') || '';
  const name = readString(body, 'name');

  const idError = validateLinkId(id);
  if (idError) return jsonError(idError, 400);

  let params;
  try {
    params = parseSubLink(link);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid link', 400);
  }

  try {
    const created = await createLink({
      id,
      owner: auth.username,
      params,
      name,
    });
    return NextResponse.json(
      { link: serializeLink(created, getOrigin(request)) },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('already taken')) {
      return jsonError(message, 409);
    }
    if (message.includes('limit reached')) {
      return jsonError(message, 429);
    }
    console.error('Create link error:', error);
    return jsonError(`Failed to create link: ${message}`, 500);
  }
}
