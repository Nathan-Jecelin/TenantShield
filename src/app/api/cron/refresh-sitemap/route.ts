import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  URLS_PER_SITEMAP,
  SITEMAP_CHUNKS,
  fetchAddressChunk,
  getNonAddressPages,
  entriesToXml,
} from "@/lib/sitemapData";

export const maxDuration = 300;

const BATCH_SIZE = 5_000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chunk = parseInt(req.nextUrl.searchParams.get("chunk") ?? "", 10);
  if (isNaN(chunk) || chunk < 0 || chunk >= SITEMAP_CHUNKS) {
    return NextResponse.json({ error: "Invalid chunk param (0-5)" }, { status: 400 });
  }

  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    let xml: string;
    let urlCount: number;

    if (chunk === 0) {
      const entries = await getNonAddressPages();
      xml = entriesToXml(entries);
      urlCount = entries.length;
    } else {
      // Fetch in parallel batches of BATCH_SIZE to avoid timeout
      const baseOffset = (chunk - 1) * URLS_PER_SITEMAP;
      const batchCount = Math.ceil(URLS_PER_SITEMAP / BATCH_SIZE);

      const batchPromises = Array.from({ length: batchCount }, (_, i) =>
        fetchAddressChunk(baseOffset + i * BATCH_SIZE, BATCH_SIZE)
      );

      const batchResults = await Promise.all(batchPromises);
      const allEntries = batchResults.flat();

      // Deduplicate by URL in case of overlapping slugs
      const seen = new Set<string>();
      const entries = allEntries.filter((e) => {
        if (seen.has(e.url)) return false;
        seen.add(e.url);
        return true;
      });

      xml = entriesToXml(entries);
      urlCount = entries.length;
    }

    // Upsert into sitemap_cache
    const { error } = await sb.from("sitemap_cache").upsert(
      {
        chunk_id: chunk,
        xml_content: xml,
        url_count: urlCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chunk_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      chunk,
      urlCount,
      xmlBytes: xml.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
