import { createClient } from "@supabase/supabase-js";
import { NEIGHBORHOOD_DATA } from "@/lib/neighborhoodData";
import { neighborhoodNameToSlug } from "@/lib/chicagoData";

export const BASE_URL = "https://mytenantshield.com";
export const URLS_PER_SITEMAP = 50_000;
export const SITEMAP_CHUNKS = 6;

interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFrequency: string;
  priority: number;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function addressToSlug(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchAddressChunk(
  offset: number,
  limit: number
): Promise<SitemapEntry[]> {
  const params = new URLSearchParams({
    $select: "address, max(violation_date) as last_mod",
    $group: "address",
    $order: "address",
    $limit: String(limit),
    $offset: String(offset),
  });

  try {
    const res = await fetch(
      `https://data.cityofchicago.org/resource/22u3-xenr.json?${params}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const rows: { address: string; last_mod?: string }[] = await res.json();
    if (!Array.isArray(rows)) return [];

    const seen = new Set<string>();
    const entries: SitemapEntry[] = [];
    for (const row of rows) {
      if (!row.address) continue;
      const slug = addressToSlug(row.address);
      if (seen.has(slug)) continue;
      seen.add(slug);
      entries.push({
        url: `${BASE_URL}/address/${slug}`,
        lastModified: row.last_mod
          ? new Date(row.last_mod).toISOString()
          : new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

export async function getNonAddressPages(): Promise<SitemapEntry[]> {
  const now = new Date().toISOString();
  const staticPages: SitemapEntry[] = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date("2026-02-01").toISOString(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date("2026-02-01").toISOString(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const neighborhoodPages: SitemapEntry[] = [
    { url: `${BASE_URL}/neighborhoods`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...Object.values(NEIGHBORHOOD_DATA).map((info) => ({
      url: `${BASE_URL}/neighborhoods/${neighborhoodNameToSlug(info.name)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    })),
  ];

  let blogPages: SitemapEntry[] = [];
  const sb = getServerSupabase();
  if (sb) {
    const { data: posts } = await sb
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("published", true);
    if (posts) {
      blogPages = posts.map((p) => ({
        url: `${BASE_URL}/blog/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at).toISOString() : now,
        changeFrequency: "monthly",
        priority: 0.6,
      }));
    }
  }

  return [...staticPages, ...neighborhoodPages, ...blogPages];
}

export function entriesToXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (e) => `<url>
<loc>${e.url}</loc>
<lastmod>${e.lastModified}</lastmod>
<changefreq>${e.changeFrequency}</changefreq>
<priority>${e.priority}</priority>
</url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
