import type { Metadata } from "next";
import { NEIGHBORHOOD_DATA } from "@/lib/neighborhoodData";
import { neighborhoodNameToSlug } from "@/lib/chicagoData";

export const revalidate = 86400; // ISR: revalidate daily

export const metadata: Metadata = {
  title: "Chicago Neighborhoods Directory — Browse Buildings by Area | TenantShield",
  description:
    "Browse all 77 Chicago neighborhoods. Find building violations, 311 complaints, and tenant reviews for rental properties in every community area.",
  openGraph: {
    title: "Chicago Neighborhoods Directory — Browse Buildings by Area | TenantShield",
    description:
      "Browse all 77 Chicago neighborhoods. Find building violations, 311 complaints, and tenant reviews for rental properties in every community area.",
    url: "https://mytenantshield.com/neighborhoods",
    siteName: "TenantShield",
    type: "website",
  },
  alternates: {
    canonical: "https://mytenantshield.com/neighborhoods",
  },
};

export default function NeighborhoodsPage() {
  const neighborhoods = Object.entries(NEIGHBORHOOD_DATA)
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Chicago Neighborhoods",
      description: "All 77 Chicago community areas",
      numberOfItems: neighborhoods.length,
      itemListElement: neighborhoods.map((n, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: n.name,
        url: `https://mytenantshield.com/neighborhoods/${neighborhoodNameToSlug(n.name)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mytenantshield.com" },
        { "@type": "ListItem", position: 2, name: "Neighborhoods", item: "https://mytenantshield.com/neighborhoods" },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ minHeight: "100vh", background: "#f6f8fa" }}>
        {/* Header */}
        <header style={{
          background: "#fff",
          borderBottom: "1px solid #e8ecf0",
          padding: "16px 0",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" rx="8" fill="#0969da" />
                <path d="M18 6L8 12v8c0 7 4.5 13.5 10 15.5 5.5-2 10-8.5 10-15.5v-8L18 6z" fill="#fff" fillOpacity=".9" />
                <path d="M14 18l3 3 5-5" stroke="#0969da" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#1f2328" }}>TenantShield</span>
            </a>
          </div>
        </header>

        {/* Breadcrumb */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 0" }}>
          <nav style={{ fontSize: 13, color: "#8b949e" }}>
            <a href="/" style={{ color: "#0969da", textDecoration: "none" }}>Home</a>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: "#1f2328" }}>Neighborhoods</span>
          </nav>
        </div>

        {/* Content */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1f2328", margin: "0 0 8px" }}>
            Chicago Neighborhoods Directory
          </h1>
          <p style={{ fontSize: 15, color: "#656d76", margin: "0 0 28px", lineHeight: 1.6 }}>
            Browse all 77 Chicago community areas. Select a neighborhood to view building violations, 311 complaints, and tenant info for every address.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}>
            {neighborhoods.map((n) => (
              <a
                key={n.id}
                href={`/neighborhoods/${neighborhoodNameToSlug(n.name)}`}
                style={{
                  display: "block",
                  padding: "18px 20px",
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e8ecf0",
                  textDecoration: "none",
                  color: "#1f2328",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, color: "#0969da", marginBottom: 6 }}>
                  {n.name}
                </div>
                <div style={{ fontSize: 13, color: "#656d76", lineHeight: 1.5, marginBottom: 10 }}>
                  {n.vibe}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "3px 8px",
                    background: "#ddf4ff",
                    borderRadius: 10,
                    fontSize: 11,
                    color: "#0969da",
                    fontWeight: 500,
                  }}>
                    {n.rentRange}
                  </span>
                  {n.notableFeatures.slice(0, 1).map((f) => (
                    <span key={f} style={{
                      padding: "3px 8px",
                      background: "#f6f8fa",
                      borderRadius: 10,
                      fontSize: 11,
                      color: "#656d76",
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
