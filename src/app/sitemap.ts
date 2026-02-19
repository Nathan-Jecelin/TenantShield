import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://mytenantshield.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-02-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2026-02-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Dynamic pages from Supabase
  let addressPages: MetadataRoute.Sitemap = [];
  let blogPages: MetadataRoute.Sitemap = [];

  const sb = getServerSupabase();
  if (sb) {
    // Fetch all addresses from the database
    const { data: addresses } = await sb
      .from("addresses")
      .select("address, updated_at");

    if (addresses && addresses.length > 0) {
      // Deduplicate by slug (same address can appear multiple times)
      const seen = new Set<string>();
      addressPages = addresses
        .map((a) => {
          const slug = addressToSlug(a.address);
          if (seen.has(slug)) return null;
          seen.add(slug);
          return {
            url: `${baseUrl}/address/${slug}`,
            lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.7,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }

    // Fetch all published blog posts
    const { data: posts } = await sb
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("published", true);

    if (posts && posts.length > 0) {
      blogPages = posts.map((p) => ({
        url: `${baseUrl}/blog/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    }
  }

  // Fallback well-known addresses if database is empty or unavailable
  if (addressPages.length === 0) {
    const fallbackAddresses = [
      "1550-n-lake-shore-dr",
      "1130-s-michigan-ave",
      "1401-w-division-st",
      "6217-s-dorchester-ave",
    ];
    addressPages = fallbackAddresses.map((slug) => ({
      url: `${baseUrl}/address/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  }

  return [...staticPages, ...blogPages, ...addressPages];
}
