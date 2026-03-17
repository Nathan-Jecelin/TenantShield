import type { Metadata } from "next";
import LandlordAlerts from "@/components/LandlordAlerts";

export const metadata: Metadata = {
  title: "Alerts — Landlord Dashboard — TenantShield",
  description:
    "View alerts for violations and 311 complaints on your claimed buildings.",
  robots: { index: false, follow: false },
};

export default function LandlordAlertsPage() {
  return <LandlordAlerts />;
}
