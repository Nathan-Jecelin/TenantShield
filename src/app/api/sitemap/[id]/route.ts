import { NextResponse } from "next/server";
import {
  URLS_PER_SITEMAP,
  SITEMAP_CHUNKS,
  fetchAddressChunk,
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

  const entries =
    id === 0
      ? await getNonAddressPages()
      : await fetchAddressChunk((id - 1) * URLS_PER_SITEMAP, URLS_PER_SITEMAP);

  return new NextResponse(entriesToXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
