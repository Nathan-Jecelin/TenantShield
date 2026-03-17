import type { Metadata } from "next";
import Script from "next/script";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyTenantShield — Free Chicago Rental Research Tool",
  description:
    "Search any Chicago address for building violations, 311 complaints, and permit history. Free tenant research tool for Chicago renters.",
  metadataBase: new URL("https://mytenantshield.com"),
  openGraph: {
    title: "MyTenantShield — Free Chicago Rental Research Tool",
    description:
      "Search any Chicago address for building violations, 311 complaints, and permit history. Free tenant research tool for Chicago renters.",
    url: "https://mytenantshield.com",
    siteName: "TenantShield",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TenantShield — Research your landlord before you sign the lease",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MyTenantShield — Free Chicago Rental Research Tool",
    description:
      "Search any Chicago address for building violations, 311 complaints, and permit history. Free tenant research tool for Chicago renters.",
    images: ["/twitter-image"],
  },
  verification: {
    google: "qomIJH8TPWRU4iNpGuiN7uMeCM1MXxM9GOd9zvH6Hjg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TenantShield",
    url: "https://mytenantshield.com",
    description:
      "Search any Chicago address for building violations, 311 complaints, and permit history. Free tenant research tool for Chicago renters.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://mytenantshield.com/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <GoogleAnalytics />
        {children}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1105551881353525"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
