import type { Metadata } from "next";
import BlogList from "@/components/BlogList";

export const metadata: Metadata = {
  title: "Blog — TenantShield",
  description:
    "Tips for Chicago renters: how to check building violations, understand your tenant rights, and find safe rental housing.",
  openGraph: {
    title: "Blog — TenantShield",
    description:
      "Tips for Chicago renters: how to check building violations, understand your tenant rights, and find safe rental housing.",
    url: "https://mytenantshield.com/blog",
    siteName: "TenantShield",
    type: "website",
  },
};

export default function BlogPage() {
  return <BlogList />;
}
