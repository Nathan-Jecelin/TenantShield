import type { Metadata } from "next";
import SearchAnalytics from "@/components/SearchAnalytics";

export const metadata: Metadata = {
  title: "Admin — Search Analytics — TenantShield",
  description: "Address view analytics and building search trends.",
};

export default function AdminAnalyticsPage() {
  return <SearchAnalytics />;
}
