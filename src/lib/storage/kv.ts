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

import { put, head, del, BlobNotFoundError } from '@vercel/blob';
import { createHmac, randomBytes } from 'crypto';
import { getAuthSecret } from '@/lib/auth/crypto';

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
 * Public blobs are used because private blobs are not available on every
 * store; the secret pathname is what keeps records unreachable.
 */
export class VercelBlobKV implements KVStore {
  readonly name = 'vercel-blob';

  isConfigured(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  private pathname(key: string): string {
    const digest = createHmac('sha256', getAuthSecret()).update(key).digest('hex');
    return `data/${digest}.json`;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        'Storage is not configured. Connect a Vercel Blob store and set the ' +
          'BLOB_READ_WRITE_TOKEN environment variable.'
      );
    }
  }

  async read<T>(key: string): Promise<T | null> {
    this.assertConfigured();

    // head() is an authenticated API call, so it always reflects the latest
    // write — unlike the CDN in front of the blob URL itself.
    let url: string;
    try {
      const meta = await head(this.pathname(key));
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

    const text = await response.text();
    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Corrupted record for key: ${key}`);
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    this.assertConfigured();

    await put(this.pathname(key), JSON.stringify(value), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      // Minimum accepted by Vercel Blob; reads bypass the cache anyway.
      cacheControlMaxAge: 60,
    });
  }

  async remove(key: string): Promise<void> {
    this.assertConfigured();

    try {
      await del(this.pathname(key));
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
