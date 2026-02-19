import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TenantShield — Chicago Landlord Reviews",
  description:
    "Tenant reviews, building violations, and landlord ratings for Chicago rental properties.",
  verification: {
    google: "qomIJH8TPWRU4iNpGuiN7uMeCM1MXxM9GOd9zvH6Hjg",
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
