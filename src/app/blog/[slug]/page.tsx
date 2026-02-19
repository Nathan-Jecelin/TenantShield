import type { Metadata } from "next";
import BlogPost from "@/components/BlogPost";
import { createClient } from "@supabase/supabase-js";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sb = getServerSupabase();
  if (!sb) {
    return { title: "Blog Post — TenantShield" };
  }

  const { data: post } = await sb
    .from("blog_posts")
    .select("title, excerpt")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!post) {
    return { title: "Post Not Found — TenantShield" };
  }

  return {
    title: `${post.title} — TenantShield Blog`,
    description: post.excerpt,
    openGraph: {
      title: `${post.title} — TenantShield Blog`,
      description: post.excerpt,
      url: `https://mytenantshield.com/blog/${slug}`,
      siteName: "TenantShield",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
    alternates: {
      canonical: `https://mytenantshield.com/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;

  const sb = getServerSupabase();
  let jsonLd = null;
  if (sb) {
    const { data: post } = await sb
      .from("blog_posts")
      .select("title, excerpt, created_at, updated_at")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (post) {
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        url: `https://mytenantshield.com/blog/${slug}`,
        datePublished: post.created_at,
        dateModified: post.updated_at,
        publisher: {
          "@type": "Organization",
          name: "TenantShield",
          url: "https://mytenantshield.com",
        },
        isPartOf: { "@type": "WebSite", name: "TenantShield", url: "https://mytenantshield.com" },
      };
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <BlogPost slug={slug} />
    </>
  );
}
