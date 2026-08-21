/**
 * Minimal JSON key-value store
 *
 * Used to persist user accounts and short subscription links, backed by
 * Vercel Blob.
 *
 * Records are stored at an unguessable pathname: `data/<hmac>.json`, where
 * the HMAC is derived from the record key and the deployment secret. Blob
 * listing requires the store's read-write token, so without that secret the
 * records cannot be found or enumerated.
 *
 * Keeping this behind a small interface makes it easy to plug in another
 * backend (Redis/KV/D1/...) later without touching the API routes.
 */

import { put, get, head, del, BlobNotFoundError } from '@vercel/blob';
import { createHmac, randomBytes } from 'crypto';
import { getAuthSecret } from '@/lib/auth/crypto';

/**
 * Token of the store holding account data. Set DATA_BLOB_READ_WRITE_TOKEN to
 * keep accounts in a store of their own, separate from uploaded files.
 */
function dataToken(): string | undefined {
  return process.env.DATA_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Blob access mode for account records.
 *
 * Private blobs are only readable with the store's token, but they are not
 * available on every store — a store that does not support them answers
 * reads with "400 Bad Request". Public (the default) works everywhere and
 * relies on the secret pathname below.
 */
function dataAccess(): 'public' | 'private' {
  return process.env.DATA_BLOB_ACCESS === 'private' ? 'private' : 'public';
}

export interface KVStore {
  /** Human readable provider identifier (e.g. "vercel-blob") */
  readonly name: string;

  /** Whether the provider is configured and ready to use */
  isConfigured(): boolean;

  /** Read a JSON record, or null when the key does not exist */
  read<T>(key: string): Promise<T | null>;

  /** Write a JSON record */
  write<T>(key: string, value: T): Promise<void>;

  /** Remove a record; missing keys are ignored */
  remove(key: string): Promise<void>;
}

/**
 * Vercel Blob backed KV store.
 *
 * Public blobs are the default because private blobs are not available on
 * every store; there the secret pathname is what keeps records unreachable.
 * Set DATA_BLOB_ACCESS=private on a store that supports private blobs to also
 * put the store token in front of every read.
 */
export class VercelBlobKV implements KVStore {
  readonly name = 'vercel-blob';

  isConfigured(): boolean {
    return Boolean(dataToken());
  }

  private pathname(key: string): string {
    const digest = createHmac('sha256', getAuthSecret()).update(key).digest('hex');
    return `data/${digest}.json`;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        'Storage is not configured. Connect a Vercel Blob store and set the ' +
          'BLOB_READ_WRITE_TOKEN (or DATA_BLOB_READ_WRITE_TOKEN) environment variable.'
      );
    }
  }

  async read<T>(key: string): Promise<T | null> {
    this.assertConfigured();

    const text =
      dataAccess() === 'private'
        ? await this.readPrivate(key)
        : await this.readPublic(key);

    if (text === null || !text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Corrupted record for key: ${key}`);
    }
  }

  /** Read through the authenticated blob API — one round trip, never cached */
  private async readPrivate(key: string): Promise<string | null> {
    const result = await get(this.pathname(key), {
      access: 'private',
      useCache: false,
      token: dataToken(),
    });

    if (!result || result.statusCode !== 200) {
      return null;
    }

    return new Response(result.stream).text();
  }

  /** Read a public blob, bypassing the CDN so writes are visible at once */
  private async readPublic(key: string): Promise<string | null> {
    // head() is an authenticated API call, so it always reflects the latest
    // write — unlike the CDN in front of the blob URL itself.
    let url: string;
    try {
      const meta = await head(this.pathname(key), { token: dataToken() });
      url = meta.url;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }

    // A rotated token or an edited mapping must take effect immediately, so
    // bypass the CDN cache with a one-off query string.
    const response = await fetch(`${url}?v=${randomBytes(8).toString('hex')}`, {
      cache: 'no-store',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to read record: HTTP ${response.status}`);
    }

    return response.text();
  }

  async write<T>(key: string, value: T): Promise<void> {
    this.assertConfigured();

    await put(this.pathname(key), JSON.stringify(value), {
      access: dataAccess(),
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token: dataToken(),
      // Minimum accepted by Vercel Blob; reads bypass the cache anyway.
      cacheControlMaxAge: 60,
    });
  }

  async remove(key: string): Promise<void> {
    this.assertConfigured();

    try {
      await del(this.pathname(key), { token: dataToken() });
    } catch (error) {
      // Deleting a missing record is not an error.
      if (error instanceof BlobNotFoundError) return;
      throw error;
    }
  }
}

let cachedStore: KVStore | null = null;

/** Get the configured KV store (currently Vercel Blob only) */
export function getKVStore(): KVStore {
  if (!cachedStore) {
    cachedStore = new VercelBlobKV();
  }
  return cachedStore;
}
