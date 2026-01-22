/**
 * Version info API route
 * 
 * GET /api/version
 */

import { NextResponse } from 'next/server';

const VERSION = '0.1.0';

export async function GET() {
  return new NextResponse(`subconverter-next ${VERSION} backend\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
