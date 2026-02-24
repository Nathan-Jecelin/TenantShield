import type { Metadata } from "next";
import LandlordDashboard from "@/components/LandlordDashboard";

export const metadata: Metadata = {
  title: "Landlord Dashboard — TenantShield",
  description:
    "Manage your buildings, track violations, and respond to tenant concerns on TenantShield.",
  openGraph: {
    title: "Landlord Dashboard — TenantShield",
    description:
      "Manage your buildings, track violations, and respond to tenant concerns on TenantShield.",
    url: "https://mytenantshield.com/landlord/dashboard",
    siteName: "TenantShield",
    type: "website",
  },
};

export default function LandlordDashboardPage() {
  return <LandlordDashboard />;
}
