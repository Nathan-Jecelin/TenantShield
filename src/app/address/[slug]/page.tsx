import type { Metadata } from "next";
import { slugToAddress } from "@/lib/slugs";
import TenantShield from "@/components/TenantShield";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const address = slugToAddress(slug);
  const title = `${address} Building Violations and Tenant Reviews — TenantShield`;
  const description = `View building violations, 311 complaints, building permits, and tenant reviews for ${address}, Chicago IL. Free public records lookup on TenantShield.`;

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
      title: `${address} — TenantShield`,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${address} Building Violations and Tenant Reviews`,
    url: `https://mytenantshield.com/address/${slug}`,
    description: `View building violations, 311 complaints, building permits, and tenant reviews for ${address}, Chicago IL.`,
    isPartOf: { "@type": "WebSite", name: "TenantShield", url: "https://mytenantshield.com" },
    about: {
      "@type": "Place",
      name: address,
      address: {
        "@type": "PostalAddress",
        streetAddress: address,
        addressLocality: "Chicago",
        addressRegion: "IL",
        addressCountry: "US",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TenantShield initialView="address-profile" initialAddress={address} />
    </>
  );
}
