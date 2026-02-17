import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TenantShield — Chicago Landlord Reviews",
  description:
    "Tenant reviews, building violations, and landlord ratings for Chicago rental properties.",
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
