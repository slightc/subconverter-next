/**
 * Sign in
 *
 * POST /api/auth/login
 * Body: { username, password }
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonError, readJsonBody, readString, requireStorage } from '@/lib/api/helpers';
import { setSessionCookie } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/crypto';
import { getUser } from '@/lib/store/users';

export async function POST(request: NextRequest) {
  const storageError = requireStorage();
  if (storageError) return storageError;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonError('Invalid JSON body', 400);
  }

  const username = readString(body, 'username') || '';
  const password = readString(body, 'password') || '';

  if (!username || !password) {
    return jsonError('Username and password are required', 400);
  }

  try {
    const user = await getUser(username);

    // Same message for unknown user and wrong password.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return jsonError('Invalid username or password', 401);
    }

    const response = NextResponse.json({ username: user.username });
    setSessionCookie(response, user.username);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonError(`Login failed: ${message}`, 500);
  }
}
