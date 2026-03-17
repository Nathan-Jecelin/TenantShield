import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  SITEMAP_CHUNKS,
  getNonAddressPages,
  entriesToXml,
} from "@/lib/sitemapData";

export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);

  if (isNaN(id) || id < 0 || id >= SITEMAP_CHUNKS) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Try to serve from Supabase cache first
  const sb = getSupabaseServer();
  if (sb) {
    const { data } = await sb
      .from("sitemap_cache")
      .select("xml_content")
      .eq("chunk_id", id)
      .single();

    if (data?.xml_content) {
      return new NextResponse(data.xml_content, {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }
  }

  // Fallback: chunk 0 can always be generated live (fast Supabase queries)
  if (id === 0) {
    const entries = await getNonAddressPages();
    return new NextResponse(entriesToXml(entries), {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }

  // Address chunks with no cache — return empty sitemap rather than timing out
  return new NextResponse(entriesToXml([]), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
