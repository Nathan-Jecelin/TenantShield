import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password — TenantShield",
  description: "Set a new password for your TenantShield landlord account.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
