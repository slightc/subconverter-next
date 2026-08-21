/**
 * Stateless session cookie
 *
 * The cookie value is `<base64url(payload)>.<hmac>` where the payload is
 * `{ u: username, exp: unix seconds }`. No session storage is required —
 * the signature is enough to trust the payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSecret, safeEqual, sign } from './crypto';

export const SESSION_COOKIE = 'sc_session';

/** Session lifetime: 30 days */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

interface SessionPayload {
  u: string;
  exp: number;
}

/** Create a signed session token for a user */
export function createSessionToken(username: string): string {
  const payload: SessionPayload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded, getAuthSecret())}`;
}

/** Verify a session token and return the username, or null when invalid */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  if (!safeEqual(signature, sign(encoded, getAuthSecret()))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (!payload.u || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;

    return payload.u;
  } catch {
    return null;
  }
}

/** Read the logged-in username from the request cookies */
export function getSessionUser(request: NextRequest): string | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

/** Attach a session cookie to a response */
export function setSessionCookie(response: NextResponse, username: string): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(username),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

/** Clear the session cookie */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
