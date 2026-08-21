/**
 * Register a new account
 *
 * POST /api/auth/register
 * Body: { username, password, code? }
 *
 * Set REGISTER_CODE to require an invite code, or DISABLE_REGISTER=true to
 * close registration entirely.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonError, readJsonBody, readString, requireStorage } from '@/lib/api/helpers';
import { setSessionCookie } from '@/lib/auth/session';
import { createUser, validatePassword, validateUsername } from '@/lib/store/users';

export async function POST(request: NextRequest) {
  const storageError = requireStorage();
  if (storageError) return storageError;

  if (process.env.DISABLE_REGISTER === 'true') {
    return jsonError('Registration is disabled', 403);
  }

  const body = await readJsonBody(request);
  if (!body) {
    return jsonError('Invalid JSON body', 400);
  }

  const username = readString(body, 'username') || '';
  const password = readString(body, 'password') || '';
  const code = readString(body, 'code') || '';

  const registerCode = process.env.REGISTER_CODE;
  if (registerCode && code !== registerCode) {
    return jsonError('Invalid invite code', 403);
  }

  const usernameError = validateUsername(username);
  if (usernameError) return jsonError(usernameError, 400);

  const passwordError = validatePassword(password);
  if (passwordError) return jsonError(passwordError, 400);

  try {
    const user = await createUser(username, password);
    const response = NextResponse.json({ username: user.username }, { status: 201 });
    setSessionCookie(response, user.username);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    if (message.includes('already taken')) {
      return jsonError(message, 409);
    }
    console.error('Registration error:', error);
    return jsonError(`Registration failed: ${message}`, 500);
  }
}
