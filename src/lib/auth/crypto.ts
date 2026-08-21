/**
 * Password hashing and token helpers
 *
 * Uses only Node's built-in crypto module — no extra dependency needed.
 */

import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'crypto';

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * Secret used to sign session cookies.
 *
 * Set AUTH_SECRET in production. As a convenience for zero-config
 * deployments it falls back to the Blob token (which is already a secret
 * of the deployment); changing either value invalidates existing sessions.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not configured. Set the AUTH_SECRET environment variable.'
    );
  }
  return secret;
}

/** Hash a password as `scrypt$<saltHex>$<hashHex>` */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Verify a password against a stored hash */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) {
    return false;
  }

  const derived = await scryptAsync(password, salt);
  return timingSafeEqual(derived, expected);
}

/** Generate a random subscription token (32 hex characters) */
export function generateToken(): string {
  return randomBytes(16).toString('hex');
}

/** Constant-time string comparison that tolerates different lengths */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still run a comparison to keep the timing roughly constant.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** HMAC-SHA256 signature, base64url encoded */
export function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}
