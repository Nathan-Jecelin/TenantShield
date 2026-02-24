import type { Metadata } from "next";
import LandlordAlerts from "@/components/LandlordAlerts";

export const metadata: Metadata = {
  title: "Alerts — Landlord Dashboard — TenantShield",
  description:
    "View alerts for violations and 311 complaints on your claimed buildings.",
  openGraph: {
    title: "Alerts — Landlord Dashboard — TenantShield",
    description:
      "View alerts for violations and 311 complaints on your claimed buildings.",
    url: "https://mytenantshield.com/landlord/dashboard/alerts",
    siteName: "TenantShield",
    type: "website",
  },
};

export default function LandlordAlertsPage() {
  return <LandlordAlerts />;
}
