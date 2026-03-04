import { NextResponse } from "next/server";
import { BASE_URL, SITEMAP_CHUNKS } from "@/lib/sitemapData";

export const dynamic = "force-dynamic";

export async function GET() {
  const sitemaps = Array.from({ length: SITEMAP_CHUNKS }, (_, i) =>
    `  <sitemap>\n    <loc>${BASE_URL}/sitemap/${i}.xml</loc>\n  </sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
