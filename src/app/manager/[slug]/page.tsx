import type { Metadata } from "next";
import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase-server";
import ManagerProfile from "@/components/ManagerProfile";

export const revalidate = 3600; // ISR: revalidate every hour

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getProfileData = cache(async (slug: string) => {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("landlord_profiles")
    .select("id, company_name, bio, website, public_phone, public_email, logo_url, years_in_business, verified, profile_visible")
    .eq("slug", slug)
    .eq("profile_visible", true)
    .maybeSingle();

  if (!profile) return null;

  // Fetch approved claimed buildings
  const { data: buildings } = await supabase
    .from("claimed_buildings")
    .select("id, address, verification_status")
    .eq("landlord_id", profile.id)
    .eq("verification_status", "approved");

  const buildingList = buildings || [];

  // Normalize addresses
  const normalizedAddresses = buildingList.map((b) =>
    b.address.toUpperCase().split(",")[0].replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, "").replace(/\s+/g, " ").trim()
  );

  // Build per-building stats
  const buildingStats: { address: string; slug: string; avgRating: number; reviewCount: number }[] = [];
  const allReviews: { rating: number }[] = [];

  for (let i = 0; i < buildingList.length; i++) {
    const addr = normalizedAddresses[i];
    let buildingReviews: { rating: number }[] = [];

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
        if (reviews) buildingReviews = reviews;
      }
    }

    const avgRating = buildingReviews.length > 0
      ? Math.round((buildingReviews.reduce((s, r) => s + r.rating, 0) / buildingReviews.length) * 10) / 10
      : 0;

    const addressSlug = buildingList[i].address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    buildingStats.push({ address: buildingList[i].address, slug: addressSlug, avgRating, reviewCount: buildingReviews.length });
    allReviews.push(...buildingReviews);
  }

  const totalReviews = allReviews.length;
  const avgRating = totalReviews > 0
    ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / totalReviews) * 10) / 10
    : 0;

  // Response rate
  let responseCount = 0;
  for (const addr of normalizedAddresses) {
    const { data: addrRows } = await supabase
      .from("addresses")
      .select("landlord_id")
      .ilike("address", `${addr}%`);
    if (addrRows && addrRows.length > 0) {
      const landlordIds = [...new Set(addrRows.map((a) => a.landlord_id).filter(Boolean))];
      if (landlordIds.length > 0) {
        const { count } = await supabase
          .from("landlord_responses")
          .select("*", { count: "exact", head: true })
          .in("landlord_id", landlordIds)
          .like("violation_id", "review_%");
        responseCount += count || 0;
      }
    }
  }

  const responseRate = totalReviews > 0 ? Math.round((responseCount / totalReviews) * 100) : 0;

  return {
    profile: {
      company_name: profile.company_name,
      bio: profile.bio,
      website: profile.website,
      public_phone: profile.public_phone,
      public_email: profile.public_email,
      logo_url: profile.logo_url,
      years_in_business: profile.years_in_business,
      verified: profile.verified,
    },
    buildings: buildingStats,
    stats: {
      totalBuildings: buildingList.length,
      avgRating,
      totalReviews,
      responseRate,
    },
  };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProfileData(slug);

  if (!data) {
    return { title: "Profile Not Found | TenantShield" };
  }

  const name = data.profile.company_name || "Property Manager";
  const { totalBuildings, avgRating, totalReviews } = data.stats;

  const parts: string[] = [];
  if (totalBuildings > 0) parts.push(`${totalBuildings} building${totalBuildings !== 1 ? "s" : ""}`);
  if (avgRating > 0) parts.push(`${avgRating.toFixed(1)} avg rating`);
  if (totalReviews > 0) parts.push(`${totalReviews} review${totalReviews !== 1 ? "s" : ""}`);

  const title = `${name} — Property Management Profile | TenantShield`;
  const description = parts.length > 0
    ? `${name} manages ${parts.join(", ")} on TenantShield. View tenant reviews, building details, and management info.`
    : `${name} property management profile on TenantShield. View tenant reviews, building details, and management info.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://mytenantshield.com/manager/${slug}`,
      siteName: "TenantShield",
      type: "website",
    },
    alternates: {
      canonical: `https://mytenantshield.com/manager/${slug}`,
    },
  };
}

export default async function ManagerPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProfileData(slug);

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6f8fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2328", margin: "0 0 8px" }}>Profile Not Found</h1>
          <p style={{ fontSize: 14, color: "#57606a" }}>
            This management company profile doesn&apos;t exist or isn&apos;t public.
          </p>
          <a href="/managers" style={{ color: "#0969da", fontSize: 14 }}>Browse all managers</a>
        </div>
      </div>
    );
  }

  const name = data.profile.company_name || "Property Manager";
  const { avgRating, totalReviews } = data.stats;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      url: `https://mytenantshield.com/manager/${slug}`,
      ...(data.profile.website ? { sameAs: data.profile.website } : {}),
      ...(data.profile.logo_url ? { logo: data.profile.logo_url } : {}),
      ...(data.profile.bio ? { description: data.profile.bio } : {}),
      ...(totalReviews > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: avgRating,
              reviewCount: totalReviews,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mytenantshield.com" },
        { "@type": "ListItem", position: 2, name: "Managers", item: "https://mytenantshield.com/managers" },
        { "@type": "ListItem", position: 3, name, item: `https://mytenantshield.com/manager/${slug}` },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ManagerProfile
        profile={data.profile}
        buildings={data.buildings}
        stats={data.stats}
      />
    </>
  );
}
