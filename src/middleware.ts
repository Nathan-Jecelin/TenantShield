import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SITEMAP_CHUNKS = 6;
const BASE_URL = "https://mytenantshield.com";

const PROTECTED_PREFIXES = ["/landlord/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sitemap index
  if (pathname === "/sitemap.xml") {
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

  // Landlord dashboard route protection
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (isProtected) {
    // Check for Supabase auth cookies — they may be stored as
    // sb-<ref>-auth-token (single cookie) or chunked as
    // sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, etc.
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

    if (!hasAuthCookie) {
      const loginUrl = new URL("/landlord/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sitemap.xml", "/landlord/dashboard/:path*"],
};
