/**
 * Storage abstraction types
 *
 * Provides a provider-agnostic interface for storing uploaded files
 * (e.g. Clash/YAML subscription configs) so that the generated public
 * URL can be consumed by the existing URL-based subscription converter.
 *
 * Currently only the Vercel Blob provider is implemented.
 */

export interface StoredFile {
  /** Publicly accessible URL of the stored file */
  url: string;
  /** Storage pathname/key of the stored file */
  pathname: string;
  /** Size of the stored content in bytes */
  size: number;
}

export interface UploadOptions {
  /** Content type of the stored file */
  contentType?: string;
}

export interface StorageProvider {
  /** Human readable provider identifier (e.g. "vercel") */
  readonly name: string;

  /** Whether the provider is configured and ready to use */
  isConfigured(): boolean;

  /**
   * Store file content and return the public URL.
   *
   * @param pathname suggested pathname/key for the file
   * @param content  file content
   * @param options  upload options
   */
  upload(
    pathname: string,
    content: string | Buffer,
    options?: UploadOptions
  ): Promise<StoredFile>;
}
