import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password — TenantShield",
  description: "Reset your TenantShield landlord account password.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
