import { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';

function normalizeAddress(raw: string): string {
  return raw
    .split(',')[0]
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip, 60)) {
    return new Response(null, { status: 429 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return new Response(null, { status: 204 });
  }

  try {
    const body = await req.json();
    const address = typeof body.address === 'string' ? normalizeAddress(body.address) : null;
    if (!address) {
      return new Response(null, { status: 204 });
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : null;
    const source = typeof body.source === 'string' ? body.source.slice(0, 32) : 'page_view';

    await supabase.from('address_views').insert({
      address,
      session_id: sessionId,
      source,
    });
  } catch {
    // Silently ignore malformed requests
  }

  return new Response(null, { status: 204 });
}
