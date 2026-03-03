import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SITEMAP_CHUNKS = 6;
const BASE_URL = "https://mytenantshield.com";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/sitemap.xml") {
    const sitemaps = Array.from(
      { length: SITEMAP_CHUNKS },
      (_, i) =>
        `  <sitemap>\n    <loc>${BASE_URL}/sitemap/${i}.xml</loc>\n  </sitemap>`
    ).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/sitemap.xml",
};
