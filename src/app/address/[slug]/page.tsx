import type { Metadata } from "next";
import { cache } from "react";
import { slugToAddress, addressToSlug } from "@/lib/slugs";
import {
  parseStreetAddress,
  generateAddressVariants,
  fetchBuildingViolations,
  fetchServiceRequests,
  fetchBuildingPermits,
  fetchCommunityAreaForAddress,
  fetchNearbyAddresses,
  neighborhoodNameToSlug,
  type BuildingViolation,
  type ServiceRequest,
  type BuildingPermit,
} from "@/lib/chicagoData";
import { NEIGHBORHOOD_DATA, type NeighborhoodInfo } from "@/lib/neighborhoodData";
import TenantShield from "@/components/TenantShield";

export const revalidate = 3600; // ISR: revalidate every hour

export async function generateStaticParams() {
  const params = new URLSearchParams({
    $select: "address, count(id) as violation_count",
    $group: "address",
    $order: "violation_count DESC",
    $limit: "200",
  });
  try {
    const res = await fetch(
      `https://data.cityofchicago.org/resource/22u3-xenr.json?${params}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const rows: { address: string }[] = await res.json();
    return rows
      .filter((r) => r.address)
      .map((r) => ({ slug: addressToSlug(r.address) }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Deduplicate data fetching between generateMetadata and page render
const getAddressData = cache(async (address: string) => {
  const parsed = parseStreetAddress(address);
  const variants = generateAddressVariants(parsed);

  const [violations, complaints, permits, communityArea] = await Promise.all([
    fetchBuildingViolations(variants).catch(() => [] as BuildingViolation[]),
    fetchServiceRequests(variants).catch(() => [] as ServiceRequest[]),
    fetchBuildingPermits(variants).catch(() => [] as BuildingPermit[]),
    fetchCommunityAreaForAddress(variants).catch(() => null),
  ]);

  const neighborhood = communityArea?.neighborhoodName ?? null;
  const neighborhoodInfo = communityArea
    ? NEIGHBORHOOD_DATA[communityArea.communityAreaId] ?? null
    : null;

  // Fetch nearby buildings in the same neighborhood (non-blocking)
  const nearbyBuildings = communityArea
    ? await fetchNearbyAddresses(communityArea.communityAreaId, parsed).catch(() => [] as { address: string; complaintCount: number }[])
    : [];

  return { violations, complaints, permits, neighborhood, neighborhoodInfo, nearbyBuildings };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const address = slugToAddress(slug);
  const { violations, complaints, neighborhood } = await getAddressData(address);

  const vCount = violations.length;
  const cCount = complaints.length;
  const neighborhoodTag = neighborhood ? ` (${neighborhood})` : "";

  const title = `${address}, Chicago${neighborhoodTag} - Violations, Reviews & Tenant Experiences | TenantShield`;

  let description: string;
  if (vCount === 0 && cCount === 0) {
    description = `${address} in Chicago${neighborhoodTag} has a clean record — no building violations or 311 complaints on file. View tenant reviews, building permits, and more on TenantShield.`;
  } else {
    const parts: string[] = [];
    if (vCount > 0) parts.push(`${vCount} building violation${vCount !== 1 ? "s" : ""}`);
    if (cCount > 0) parts.push(`${cCount} 311 complaint${cCount !== 1 ? "s" : ""}`);
    description = `${address} in Chicago${neighborhoodTag} has ${parts.join(" and ")} on record. View full details, tenant reviews, and building permits on TenantShield.`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://mytenantshield.com/address/${slug}`,
      siteName: "TenantShield",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${address}${neighborhoodTag} — TenantShield`,
      description,
    },
    alternates: {
      canonical: `https://mytenantshield.com/address/${slug}`,
    },
  };
}

export default async function AddressPage({ params }: PageProps) {
  const { slug } = await params;
  const address = slugToAddress(slug);
  const { violations, complaints, permits, neighborhood, neighborhoodInfo, nearbyBuildings } =
    await getAddressData(address);

  const vCount = violations.length;
  const cCount = complaints.length;
  const neighborhoodTag = neighborhood ? ` (${neighborhood})` : "";

  const metaDescription =
    vCount === 0 && cCount === 0
      ? `${address} in Chicago${neighborhoodTag} has a clean record with no violations or complaints on file.`
      : `${address} in Chicago${neighborhoodTag} has ${vCount} building violation${vCount !== 1 ? "s" : ""} and ${cCount} 311 complaint${cCount !== 1 ? "s" : ""} on record.`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ApartmentComplex",
      name: address,
      address: {
        "@type": "PostalAddress",
        streetAddress: address,
        addressLocality: "Chicago",
        addressRegion: "IL",
        addressCountry: "US",
        ...(neighborhood ? { addressNeighborhood: neighborhood } : {}),
      },
      ...(neighborhood ? { containedInPlace: { "@type": "Place", name: `${neighborhood}, Chicago` } } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mytenantshield.com" },
        { "@type": "ListItem", position: 2, name: "Chicago", item: "https://mytenantshield.com" },
        ...(neighborhood
          ? [{ "@type": "ListItem", position: 3, name: neighborhood, item: `https://mytenantshield.com/neighborhoods/${neighborhoodNameToSlug(neighborhood)}` }]
          : []),
        {
          "@type": "ListItem",
          position: neighborhood ? 4 : 3,
          name: address,
          item: `https://mytenantshield.com/address/${slug}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${address} Building Violations and Tenant Reviews`,
      url: `https://mytenantshield.com/address/${slug}`,
      description: metaDescription,
      dateModified: new Date().toISOString(),
      isPartOf: { "@type": "WebSite", name: "TenantShield", url: "https://mytenantshield.com" },
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TenantShield
        initialView="address-profile"
        initialAddress={address}
        initialData={{ address, violations, complaints, permits }}
        neighborhood={neighborhood}
        neighborhoodInfo={neighborhoodInfo}
        nearbyBuildings={nearbyBuildings}
      />
    </>
  );
}
