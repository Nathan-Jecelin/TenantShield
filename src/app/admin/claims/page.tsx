import type { Metadata } from "next";
import AdminClaims from "@/components/AdminClaims";

export const metadata: Metadata = {
  title: "Admin — Building Claims Review — TenantShield",
  description: "Review and approve or reject pending building claims.",
};

export default function AdminClaimsPage() {
  return <AdminClaims />;
}
