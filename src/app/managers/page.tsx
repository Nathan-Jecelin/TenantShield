import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase-server";
import ManagerDirectory from "@/components/ManagerDirectory";

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata: Metadata = {
  title: "Property Management Companies — Chicago | TenantShield",
  description:
    "Browse verified property management companies in Chicago. View ratings, tenant reviews, response rates, and managed buildings on TenantShield.",
  openGraph: {
    title: "Property Management Companies — Chicago | TenantShield",
    description:
      "Browse verified property management companies in Chicago. View ratings, tenant reviews, response rates, and managed buildings on TenantShield.",
    url: "https://mytenantshield.com/managers",
    siteName: "TenantShield",
    type: "website",
  },
  alternates: {
    canonical: "https://mytenantshield.com/managers",
  },
};

interface ManagerEntry {
  slug: string;
  company_name: string;
  logo_url: string | null;
  totalBuildings: number;
  avgRating: number;
  totalReviews: number;
  responseRate: number;
}

export default async function ManagersPage() {
  const supabase = getSupabaseServer();
  const managers: ManagerEntry[] = [];

  if (supabase) {
    // Fetch all visible profiles that have a slug
    const { data: profiles } = await supabase
      .from("landlord_profiles")
      .select("id, company_name, slug, logo_url")
      .eq("profile_visible", true)
      .not("slug", "is", null);

    if (profiles) {
      for (const p of profiles) {
        if (!p.slug || !p.company_name) continue;

        // Check for at least one approved claimed building
        const { data: buildings } = await supabase
          .from("claimed_buildings")
          .select("address")
          .eq("landlord_id", p.id)
          .eq("verification_status", "approved");

        if (!buildings || buildings.length === 0) continue;

        // Compute stats via address-to-review chain
        const normalizedAddresses = buildings.map((b) =>
          b.address.toUpperCase().split(",")[0].replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, "").replace(/\s+/g, " ").trim()
        );

        const allReviews: { rating: number }[] = [];
        let totalResponses = 0;

        for (const addr of normalizedAddresses) {
          const { data: addrRows } = await supabase
            .from("addresses")
            .select("landlord_id")
            .ilike("address", `${addr}%`);

          if (addrRows && addrRows.length > 0) {
            const landlordIds = [...new Set(addrRows.map((a) => a.landlord_id).filter(Boolean))];
            if (landlordIds.length > 0) {
              const { data: reviews } = await supabase
                .from("reviews")
                .select("rating")
                .in("landlord_id", landlordIds)
                .eq("moderation_status", "approved");
              if (reviews) allReviews.push(...reviews);

              const { count } = await supabase
                .from("landlord_responses")
                .select("*", { count: "exact", head: true })
                .in("landlord_id", landlordIds)
                .like("violation_id", "review_%");
              totalResponses += count || 0;
            }
          }
        }

        const totalReviews = allReviews.length;
        const avgRating = totalReviews > 0
          ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / totalReviews) * 10) / 10
          : 0;
        const responseRate = totalReviews > 0
          ? Math.round((totalResponses / totalReviews) * 100)
          : 0;

        managers.push({
          slug: p.slug,
          company_name: p.company_name,
          logo_url: p.logo_url,
          totalBuildings: buildings.length,
          avgRating,
          totalReviews,
          responseRate,
        });
      }
    }
  }

  // Sort by rating descending by default
  managers.sort((a, b) => b.avgRating - a.avgRating);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Property Management Companies — Chicago",
      description: "Verified property management companies in Chicago",
      numberOfItems: managers.length,
      itemListElement: managers.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: m.company_name,
        url: `https://mytenantshield.com/manager/${m.slug}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mytenantshield.com" },
        { "@type": "ListItem", position: 2, name: "Managers", item: "https://mytenantshield.com/managers" },
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
        <header style={{ background: "#fff", borderBottom: "1px solid #e8ecf0", padding: "16px 0" }}>
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
            <span style={{ color: "#1f2328" }}>Managers</span>
          </nav>
        </div>

        {/* Content */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1f2328", margin: "0 0 8px" }}>
            Property Management Companies
          </h1>
          <p style={{ fontSize: 15, color: "#656d76", margin: "0 0 28px", lineHeight: 1.6 }}>
            Browse verified management companies in Chicago. View tenant ratings, response rates, and the buildings they manage.
          </p>

          <ManagerDirectory managers={managers} />
        </main>
      </div>
    </>
  );
}
