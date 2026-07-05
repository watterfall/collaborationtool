// Public open collaboration feed.
//
// No auth: ADR-0018 treats open content as a read-only public surface.
// Writers still go through POST /api/publish and signed Merkle entries.

import { NextResponse } from 'next/server';

import { parseFeedFilter } from '@/lib/open-content-feed';
import { loadOpenContentFeedSafely } from '@/lib/open-content-feed-query';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const filter = parseFeedFilter(new URL(request.url).searchParams);
  const result = await loadOpenContentFeedSafely(filter);

  return NextResponse.json(
    {
      ...result.feed,
      unavailable: result.unavailable,
      generatedAt: new Date().toISOString(),
      ...(result.unavailable ? { error: 'open-feed-unavailable' } : {}),
    },
    { status: result.unavailable ? 503 : 200 },
  );
}
