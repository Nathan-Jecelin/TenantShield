import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { NEIGHBORHOOD_DATA } from "@/lib/neighborhoodData";
import { neighborhoodNameToSlug } from "@/lib/chicagoData";

const BASE_URL = "https://mytenantshield.com";
const URLS_PER_SITEMAP = 50_000;

// 6 chunks: 0 = non-address pages, 1-5 = up to 250K addresses.
// Empty chunks produce a valid <urlset> with 0 URLs (Google ignores them).
const SITEMAP_CHUNKS = 6;

// ISR: rebuild sitemaps daily
export const revalidate = 86400;

// ─── Helpers ───

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

// ─── Data fetchers ───

/**
 * Fetch one page of unique addresses from the Chicago Building Violations API.
 * Uses $group to get distinct addresses + most recent violation date.
 * Each call fetches up to 50K addresses (one Socrata request).
 */
async function fetchAddressChunk(
  offset: number,
  limit: number
): Promise<MetadataRoute.Sitemap> {
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
    const entries: MetadataRoute.Sitemap = [];
    for (const row of rows) {
      if (!row.address) continue;
      const slug = addressToSlug(row.address);
      if (seen.has(slug)) continue;
      seen.add(slug);
      entries.push({
        url: `${BASE_URL}/address/${slug}`,
        lastModified: row.last_mod ? new Date(row.last_mod) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

/** Non-address pages: static, neighborhoods, blog posts. */
async function getNonAddressPages(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date("2026-02-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date("2026-02-01"), changeFrequency: "yearly", priority: 0.3 },
  ];

  const neighborhoodPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/neighborhoods`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    ...Object.values(NEIGHBORHOOD_DATA).map((info) => ({
      url: `${BASE_URL}/neighborhoods/${neighborhoodNameToSlug(info.name)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  let blogPages: MetadataRoute.Sitemap = [];
  const sb = getServerSupabase();
  if (sb) {
    const { data: posts } = await sb
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("published", true);
    if (posts) {
      blogPages = posts.map((p) => ({
        url: `${BASE_URL}/blog/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    }
  }

  return [...staticPages, ...neighborhoodPages, ...blogPages];
}

// ─── Sitemap index ───

export async function generateSitemaps() {
  // Fixed chunk count — no API calls needed here.
  // Chunk 0 = non-address pages, chunks 1-5 = 50K addresses each.
  return Array.from({ length: SITEMAP_CHUNKS }, (_, i) => ({ id: i }));
}

export default async function sitemap(
  props: { id: number } | Promise<{ id: number }>
): Promise<MetadataRoute.Sitemap> {
  // In Next.js 16, props.id is a Promise
  const id = Number(await Promise.resolve((props as { id: number | Promise<number> }).id));

  // Chunk 0: non-address pages only
  if (id === 0) {
    return getNonAddressPages();
  }

  // Chunks 1+: address pages, 50K per chunk
  const addressOffset = (id - 1) * URLS_PER_SITEMAP;
  return fetchAddressChunk(addressOffset, URLS_PER_SITEMAP);
}
