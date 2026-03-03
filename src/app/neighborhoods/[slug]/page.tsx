import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NEIGHBORHOOD_DATA } from "@/lib/neighborhoodData";
import {
  NEIGHBORHOOD_SLUG_TO_ID,
  neighborhoodNameToSlug,
  fetchNeighborhoodData,
} from "@/lib/chicagoData";
import { addressToSlug } from "@/lib/slugs";

export const revalidate = 3600; // ISR: revalidate hourly

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const communityAreaId = NEIGHBORHOOD_SLUG_TO_ID[slug];
  if (!communityAreaId) return {};
  const info = NEIGHBORHOOD_DATA[communityAreaId];
  if (!info) return {};

  const title = `${info.name}, Chicago — Building Violations & Tenant Info | TenantShield`;
  const description = `Browse building violations, 311 complaints, and tenant reviews for rental properties in ${info.name}, Chicago. ${info.description.split(".")[0]}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://mytenantshield.com/neighborhoods/${slug}`,
      siteName: "TenantShield",
      type: "website",
    },
    alternates: {
      canonical: `https://mytenantshield.com/neighborhoods/${slug}`,
    },
  };
}

export default async function NeighborhoodDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const communityAreaId = NEIGHBORHOOD_SLUG_TO_ID[slug];
  if (!communityAreaId) notFound();
  const info = NEIGHBORHOOD_DATA[communityAreaId];
  if (!info) notFound();

  const { allAddresses } = await fetchNeighborhoodData(communityAreaId);
  const totalComplaints = allAddresses.reduce((sum, a) => sum + a.count, 0);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Place",
      name: `${info.name}, Chicago`,
      description: info.description,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Chicago",
        addressRegion: "IL",
        addressCountry: "US",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mytenantshield.com" },
        { "@type": "ListItem", position: 2, name: "Neighborhoods", item: "https://mytenantshield.com/neighborhoods" },
        { "@type": "ListItem", position: 3, name: info.name, item: `https://mytenantshield.com/neighborhoods/${slug}` },
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
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", gap: 12 }}>
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
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 20px 0" }}>
          <nav style={{ fontSize: 13, color: "#8b949e" }}>
            <a href="/" style={{ color: "#0969da", textDecoration: "none" }}>Home</a>
            <span style={{ margin: "0 6px" }}>/</span>
            <a href="/neighborhoods" style={{ color: "#0969da", textDecoration: "none" }}>Neighborhoods</a>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: "#1f2328" }}>{info.name}</span>
          </nav>
        </div>

        {/* Content */}
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1f2328", margin: "0 0 8px" }}>
            {info.name}, Chicago
          </h1>
          <p style={{ fontSize: 15, color: "#656d76", margin: "0 0 24px", lineHeight: 1.6 }}>
            {info.description}
          </p>

          {/* Neighborhood info grid */}
          <div style={{
            border: "1px solid #e8ecf0",
            borderRadius: 8,
            background: "#fff",
            padding: "20px 24px",
            marginBottom: 20,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
              <div style={{ padding: 12, background: "#f6f8fa", borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4, fontWeight: 600 }}>VIBE</div>
                <div style={{ fontSize: 13, color: "#1f2328" }}>{info.vibe}</div>
              </div>
              <div style={{ padding: 12, background: "#f6f8fa", borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4, fontWeight: 600 }}>TRANSIT</div>
                <div style={{ fontSize: 13, color: "#1f2328" }}>{info.transitAccess}</div>
              </div>
              <div style={{ padding: 12, background: "#f6f8fa", borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4, fontWeight: 600 }}>RENT RANGE</div>
                <div style={{ fontSize: 13, color: "#1f2328" }}>{info.rentRange}</div>
              </div>
            </div>
            {info.notableFeatures.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 600, marginBottom: 6 }}>NOTABLE FEATURES</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {info.notableFeatures.map((f) => (
                    <span key={f} style={{ padding: "4px 10px", background: "#ddf4ff", borderRadius: 12, fontSize: 12, color: "#0969da" }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary stats */}
          <div style={{
            display: "flex",
            gap: 14,
            marginBottom: 20,
            flexWrap: "wrap",
          }}>
            <div style={{
              flex: 1,
              minWidth: 140,
              padding: "16px 20px",
              background: "#fff",
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1f2328" }}>{allAddresses.length}</div>
              <div style={{ fontSize: 12, color: "#8b949e", fontWeight: 500 }}>Buildings Found</div>
            </div>
            <div style={{
              flex: 1,
              minWidth: 140,
              padding: "16px 20px",
              background: "#fff",
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1f2328" }}>{totalComplaints}</div>
              <div style={{ fontSize: 12, color: "#8b949e", fontWeight: 500 }}>Recent 311 Complaints</div>
            </div>
          </div>

          {/* Building list */}
          <div style={{
            border: "1px solid #e8ecf0",
            borderRadius: 8,
            background: "#fff",
            padding: "20px 24px",
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#1f2328", margin: "0 0 16px" }}>
              Buildings in {info.name}
            </h2>
            {allAddresses.length === 0 ? (
              <p style={{ fontSize: 14, color: "#8b949e" }}>No building data available yet for this neighborhood.</p>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 8,
              }}>
                {allAddresses.map((b) => (
                  <a
                    key={b.address}
                    href={`/address/${addressToSlug(b.address)}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#f6f8fa",
                      borderRadius: 6,
                      textDecoration: "none",
                      color: "#1f2328",
                      border: "1px solid transparent",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#0969da" }}>
                      {b.address}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: "#8b949e",
                      background: "#fff",
                      padding: "2px 8px",
                      borderRadius: 10,
                      border: "1px solid #e8ecf0",
                      whiteSpace: "nowrap",
                    }}>
                      {b.count} complaint{b.count !== 1 ? "s" : ""}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
