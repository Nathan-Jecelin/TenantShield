import type { Metadata } from "next";
import LandlordSignup from "@/components/LandlordSignup";

export const metadata: Metadata = {
  title: "Landlord Signup — TenantShield",
  description:
    "Sign up as a landlord on TenantShield. Claim your buildings, monitor violations, and respond to tenant concerns.",
  openGraph: {
    title: "Landlord Signup — TenantShield",
    description:
      "Sign up as a landlord on TenantShield. Claim your buildings, monitor violations, and respond to tenant concerns.",
    url: "https://mytenantshield.com/landlord/signup",
    siteName: "TenantShield",
    type: "website",
  },
};

export default function LandlordSignupPage() {
  return <LandlordSignup />;
}
