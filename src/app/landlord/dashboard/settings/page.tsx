import type { Metadata } from "next";
import LandlordSettings from "@/components/LandlordSettings";

export const metadata: Metadata = {
  title: "Settings — Landlord Dashboard — TenantShield",
  description:
    "Manage your billing and subscription settings on TenantShield.",
  openGraph: {
    title: "Settings — Landlord Dashboard — TenantShield",
    description:
      "Manage your billing and subscription settings on TenantShield.",
    url: "https://mytenantshield.com/landlord/dashboard/settings",
    siteName: "TenantShield",
    type: "website",
  },
};

export default function LandlordSettingsPage() {
  return <LandlordSettings />;
}
