/**
 * Storage provider factory
 *
 * Selects the storage backend used to persist uploaded subscription files.
 * For now only the Vercel Blob provider is supported ("先只支持vercel").
 * Additional providers (S3, R2, local, ...) can be added here later.
 */

import { StorageProvider } from './types';
import { VercelBlobStorage } from './vercel';

export type { StorageProvider, StoredFile, UploadOptions } from './types';
export { VercelBlobStorage } from './vercel';

export type StorageProviderName = 'vercel';

/**
 * Get the configured storage provider.
 *
 * The provider can be selected via the STORAGE_PROVIDER environment
 * variable. Currently only "vercel" is implemented.
 */
export function getStorageProvider(
  name: StorageProviderName = (process.env.STORAGE_PROVIDER as StorageProviderName) ||
    'vercel'
): StorageProvider {
  switch (name) {
    case 'vercel':
      return new VercelBlobStorage();
    default:
      throw new Error(`Unsupported storage provider: ${name}`);
  }
}
