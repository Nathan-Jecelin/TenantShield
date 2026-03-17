import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Email — TenantShield",
  description: "Verify your email address to complete TenantShield landlord signup.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
