import type { Metadata } from "next";
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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
