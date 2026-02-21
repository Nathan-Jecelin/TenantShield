import type { Metadata } from "next";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "TenantShield — Look Up Building Violations for Any Chicago Address",
  description:
    "Free tool to search building violations, 311 complaints, and tenant reviews for Chicago rental properties before you sign a lease.",
  metadataBase: new URL("https://mytenantshield.com"),
  openGraph: {
    title: "TenantShield — Look Up Building Violations for Any Chicago Address",
    description:
      "Free tool to search building violations, 311 complaints, and tenant reviews for Chicago rental properties before you sign a lease.",
    url: "https://mytenantshield.com",
    siteName: "TenantShield",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenantShield — Look Up Building Violations for Any Chicago Address",
    description:
      "Free tool to search building violations, 311 complaints, and tenant reviews for Chicago rental properties before you sign a lease.",
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
      "Free tool to search building violations, 311 complaints, and tenant reviews for Chicago rental properties before you sign a lease.",
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
      </body>
    </html>
  );
}
