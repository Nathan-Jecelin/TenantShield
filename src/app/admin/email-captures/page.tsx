import type { Metadata } from "next";
import AdminEmailCaptures from "@/components/AdminEmailCaptures";

export const metadata: Metadata = {
  title: "Admin — Email Captures — TenantShield",
  description: "Manage captured emails from PDF building report requests.",
};

export default function AdminEmailCapturesPage() {
  return <AdminEmailCaptures />;
}
