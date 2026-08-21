/**
 * Short subscription links
 *
 * A link maps a short, user chosen id to a set of /api/sub parameters.
 * It is served as `/api/s/<id>?token=<token>`; the token can be rotated by
 * the owner at any time, which immediately invalidates the old URL.
 */

import { getKVStore } from '@/lib/storage/kv';
import { generateToken } from '@/lib/auth/crypto';
import { SubParams } from '@/lib/subconvert';
import { getUser, normalizeUsername, saveUser } from './users';

export interface LinkRecord {
  /** Short id (lowercase), unique across the service */
  id: string;
  /** Normalized username of the owner */
  owner: string;
  /** Optional display name */
  name: string;
  /** Current subscription token */
  token: string;
  /** Stored /api/sub parameters */
  params: SubParams;
  createdAt: string;
  updatedAt: string;
  tokenRotatedAt: string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;

/** Ids that would be confusing or collide with other routes */
const RESERVED_IDS = new Set([
  'api',
  'sub',
  'new',
  'admin',
  'account',
  'login',
  'logout',
  'register',
  'null',
  'undefined',
]);

const MAX_LINKS_PER_USER = 20;
const MAX_NAME_LENGTH = 64;

/** Normalize a short id */
export function normalizeLinkId(id: string): string {
  return id.trim().toLowerCase();
}

/** Validate a short id; returns an error message or null */
export function validateLinkId(id: string): string | null {
  const normalized = normalizeLinkId(id);
  if (!normalized) {
    return 'ID is required';
  }
  if (!ID_PATTERN.test(normalized)) {
    return 'ID must be 3-32 characters, start with a letter or digit, and only contain letters, digits, - and _';
  }
  if (RESERVED_IDS.has(normalized)) {
    return `ID "${normalized}" is reserved`;
  }
  return null;
}

function linkKey(id: string): string {
  return `link:${normalizeLinkId(id)}`;
}

/** Load a link record by id */
export async function getLink(id: string): Promise<LinkRecord | null> {
  const normalized = normalizeLinkId(id);
  if (validateLinkId(normalized)) {
    return null;
  }
  return getKVStore().read<LinkRecord>(linkKey(normalized));
}

/** List all links owned by a user (missing records are skipped) */
export async function listUserLinks(username: string): Promise<LinkRecord[]> {
  const user = await getUser(username);
  if (!user) return [];

  const links = await Promise.all(user.links.map((id) => getLink(id)));
  return links.filter((link): link is LinkRecord => link !== null);
}

/**
 * Create a new short link for a user.
 * Throws when the id is taken or the user reached the link limit.
 */
export async function createLink(options: {
  id: string;
  owner: string;
  params: SubParams;
  name?: string;
}): Promise<LinkRecord> {
  const id = normalizeLinkId(options.id);
  const owner = normalizeUsername(options.owner);

  const idError = validateLinkId(id);
  if (idError) {
    throw new Error(idError);
  }

  const user = await getUser(owner);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.links.length >= MAX_LINKS_PER_USER) {
    throw new Error(`Link limit reached (max ${MAX_LINKS_PER_USER} per user)`);
  }

  const existing = await getLink(id);
  if (existing) {
    throw new Error(`ID "${id}" is already taken`);
  }

  const now = new Date().toISOString();
  const link: LinkRecord = {
    id,
    owner,
    name: sanitizeName(options.name),
    token: generateToken(),
    params: options.params,
    createdAt: now,
    updatedAt: now,
    tokenRotatedAt: now,
  };

  await getKVStore().write(linkKey(id), link);

  user.links = [...user.links, id];
  await saveUser(user);

  return link;
}

/** Update the mapping (and optionally the name) of an existing link */
export async function updateLink(
  link: LinkRecord,
  updates: { params?: SubParams; name?: string }
): Promise<LinkRecord> {
  const updated: LinkRecord = {
    ...link,
    params: updates.params ?? link.params,
    name: updates.name !== undefined ? sanitizeName(updates.name) : link.name,
    updatedAt: new Date().toISOString(),
  };

  await getKVStore().write(linkKey(link.id), updated);
  return updated;
}

/** Rotate the token of a link, invalidating the previous subscription URL */
export async function rotateLinkToken(link: LinkRecord): Promise<LinkRecord> {
  const now = new Date().toISOString();
  const updated: LinkRecord = {
    ...link,
    token: generateToken(),
    updatedAt: now,
    tokenRotatedAt: now,
  };

  await getKVStore().write(linkKey(link.id), updated);
  return updated;
}

/** Delete a link and detach it from its owner */
export async function deleteLink(link: LinkRecord): Promise<void> {
  await getKVStore().remove(linkKey(link.id));

  const user = await getUser(link.owner);
  if (user) {
    user.links = user.links.filter((id) => id !== link.id);
    await saveUser(user);
  }
}

function sanitizeName(name?: string): string {
  return (name || '').trim().slice(0, MAX_NAME_LENGTH);
}
