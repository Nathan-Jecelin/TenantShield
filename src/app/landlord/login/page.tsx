import type { Metadata } from "next";
import LandlordLogin from "@/components/LandlordLogin";

export const metadata: Metadata = {
  title: "Log In — TenantShield",
  description:
    "Log in to your TenantShield landlord dashboard. Manage your buildings, monitor violations, and respond to tenant concerns.",
  openGraph: {
    title: "Log In — TenantShield",
    description:
      "Log in to your TenantShield landlord dashboard.",
    url: "https://mytenantshield.com/landlord/login",
    siteName: "TenantShield",
    type: "website",
  },
};

export default function LandlordLoginPage() {
  return <LandlordLogin />;
}
