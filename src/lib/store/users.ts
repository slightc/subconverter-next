/**
 * User records
 *
 * The simplest possible account model: a username, a password hash and the
 * list of short link ids the user owns.
 */

import { getKVStore } from '@/lib/storage/kv';
import { hashPassword } from '@/lib/auth/crypto';

export interface UserRecord {
  /** Normalized (lowercase) username, also used as the key */
  username: string;
  /** scrypt password hash */
  passwordHash: string;
  createdAt: string;
  /** Short link ids owned by this user */
  links: string[];
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

/** Normalize a username for storage/lookup */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Validate a username; returns an error message or null */
export function validateUsername(username: string): string | null {
  if (!username || !username.trim()) {
    return 'Username is required';
  }
  if (!USERNAME_PATTERN.test(username.trim())) {
    return 'Username must be 3-32 characters (letters, digits, - and _)';
  }
  return null;
}

/** Validate a password; returns an error message or null */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  return null;
}

function userKey(username: string): string {
  return `user:${normalizeUsername(username)}`;
}

/** Load a user record */
export async function getUser(username: string): Promise<UserRecord | null> {
  const user = await getKVStore().read<UserRecord>(userKey(username));
  if (!user) return null;
  // Older records may not have the links array.
  return { ...user, links: user.links || [] };
}

/** Persist a user record */
export async function saveUser(user: UserRecord): Promise<void> {
  await getKVStore().write(userKey(user.username), user);
}

/**
 * Create a new user. Throws when the username is already taken.
 */
export async function createUser(
  username: string,
  password: string
): Promise<UserRecord> {
  const normalized = normalizeUsername(username);

  const existing = await getUser(normalized);
  if (existing) {
    throw new Error('Username is already taken');
  }

  const user: UserRecord = {
    username: normalized,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    links: [],
  };

  await saveUser(user);
  return user;
}
