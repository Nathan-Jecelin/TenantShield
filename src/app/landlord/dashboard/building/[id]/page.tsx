import type { Metadata } from "next";
import LandlordBuildingDetail from "@/components/LandlordBuildingDetail";

export const metadata: Metadata = {
  title: "Building Detail — Landlord Dashboard — TenantShield",
  description:
    "View detailed violation history, 311 complaints, building score, and neighborhood benchmarks for your claimed building.",
  openGraph: {
    title: "Building Detail — Landlord Dashboard — TenantShield",
    description:
      "View detailed violation history, 311 complaints, building score, and neighborhood benchmarks for your claimed building.",
    url: "https://mytenantshield.com/landlord/dashboard/building",
    siteName: "TenantShield",
    type: "website",
  },
};

export default function LandlordBuildingDetailPage() {
  return <LandlordBuildingDetail />;
}
