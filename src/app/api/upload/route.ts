/**
 * File upload API route
 *
 * POST /api/upload
 *
 * Accepts a YAML subscription/config file and stores it using the configured
 * storage provider (currently Vercel Blob only). Returns the public URL of the
 * stored file, which can then be used as the `url` parameter of /api/sub.
 *
 * Accepts either:
 * - multipart/form-data with a `file` field, or
 * - a raw request body (text/yaml, application/yaml, text/plain)
 */

import { NextRequest, NextResponse } from 'next/server';
import YAML from 'yaml';
import { getStorageProvider } from '@/lib/storage';

// Maximum upload size: 1 MB (subscription configs are small)
const MAX_UPLOAD_SIZE = 1024 * 1024;

// Accepted file extensions
const ACCEPTED_EXTENSIONS = ['.yaml', '.yml', '.txt'];

export async function POST(request: NextRequest) {
  try {
    const { content, filename } = await readUpload(request);

    if (content === null) {
      return NextResponse.json(
        { error: 'No file provided. Upload a file via multipart/form-data (field "file") or a raw request body.' },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Uploaded file is empty' },
        { status: 400 }
      );
    }

    if (Buffer.byteLength(content) > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024} KB` },
        { status: 413 }
      );
    }

    // Validate that the content is parseable YAML.
    try {
      YAML.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Invalid YAML file' },
        { status: 400 }
      );
    }

    const storage = getStorageProvider();

    if (!storage.isConfigured()) {
      return NextResponse.json(
        {
          error:
            'Storage is not configured. Connect a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.',
        },
        { status: 503 }
      );
    }

    const safeName = buildPathname(filename);
    const stored = await storage.upload(safeName, content, {
      contentType: 'text/yaml; charset=utf-8',
    });

    return NextResponse.json(
      {
        url: stored.url,
        pathname: stored.pathname,
        size: stored.size,
        provider: storage.name,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Read uploaded content from either multipart form-data or a raw body.
 */
async function readUpload(
  request: NextRequest
): Promise<{ content: string | null; filename: string }> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return { content: null, filename: 'sub.yaml' };
    }

    const text = await file.text();
    return { content: text, filename: file.name || 'sub.yaml' };
  }

  // Raw body upload
  const text = await request.text();
  return {
    content: text.length > 0 ? text : null,
    filename: 'sub.yaml',
  };
}

/**
 * Build a safe storage pathname from the uploaded filename.
 * A random suffix is added by the storage provider to guarantee uniqueness.
 */
function buildPathname(filename: string): string {
  const base = filename.split(/[\\/]/).pop() || 'sub.yaml';
  const hasExt = ACCEPTED_EXTENSIONS.some((ext) =>
    base.toLowerCase().endsWith(ext)
  );
  const name = hasExt ? base : `${base}.yaml`;
  // Keep only safe characters for the pathname.
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `uploads/${sanitized}`;
}
