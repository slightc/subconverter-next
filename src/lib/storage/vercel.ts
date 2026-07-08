/**
 * Vercel Blob storage provider
 *
 * Uses @vercel/blob to store uploaded files. Requires a Blob store to be
 * connected to the deployment, which exposes the BLOB_READ_WRITE_TOKEN
 * environment variable. See https://vercel.com/docs/storage/vercel-blob
 */

import { put } from '@vercel/blob';
import { StorageProvider, StoredFile, UploadOptions } from './types';

export class VercelBlobStorage implements StorageProvider {
  readonly name = 'vercel';

  isConfigured(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  async upload(
    pathname: string,
    content: string | Buffer,
    options: UploadOptions = {}
  ): Promise<StoredFile> {
    if (!this.isConfigured()) {
      throw new Error(
        'Vercel Blob storage is not configured. Please connect a Blob store ' +
          'and set the BLOB_READ_WRITE_TOKEN environment variable.'
      );
    }

    const blob = await put(pathname, content, {
      access: 'public',
      contentType: options.contentType,
      // Ensure uploads never clobber each other.
      addRandomSuffix: true,
    });

    const size =
      typeof content === 'string' ? Buffer.byteLength(content) : content.length;

    return {
      url: blob.url,
      pathname: blob.pathname,
      size,
    };
  }
}
