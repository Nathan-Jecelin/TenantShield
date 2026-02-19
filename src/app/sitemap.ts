import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
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

  // Well-known Chicago addresses that have been searched
  // These provide initial coverage; as users search more addresses,
  // they get indexed when Google follows internal links
  const knownAddresses = [
    "1550-n-lake-shore-dr",
    "1130-s-michigan-ave",
    "1401-w-division-st",
    "6217-s-dorchester-ave",
  ];

  const addressPages: MetadataRoute.Sitemap = knownAddresses.map((slug) => ({
    url: `${baseUrl}/address/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...addressPages];
}
