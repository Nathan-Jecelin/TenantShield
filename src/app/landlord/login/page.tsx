import type { Metadata } from "next";
import LandlordLogin from "@/components/LandlordLogin";

export const metadata: Metadata = {
  title: "Log In — TenantShield",
  description:
    "Log in to your TenantShield landlord dashboard. Manage your buildings, monitor violations, and respond to tenant concerns.",
  robots: { index: false, follow: false },
};

export default function LandlordLoginPage() {
  return <LandlordLogin />;
}
