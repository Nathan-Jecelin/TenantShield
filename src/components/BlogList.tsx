"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import NewsletterSignup from "@/components/NewsletterSignup";

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  created_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.from("blog_posts")
      .select("slug, title, excerpt, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPosts(data);
        setLoading(false);
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fa",
        color: "#1f2328",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      }}
    >
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #e8ecf0",
        }}
      >
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "#1f2328",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1f6feb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 16 }}>TenantShield</span>
        </a>
        <a
          href="/"
          style={{
            fontSize: 13,
            color: "#1f6feb",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Search Addresses
        </a>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 20px" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#1f2328",
            margin: "0 0 8px",
          }}
        >
          Blog
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#57606a",
            margin: "0 0 36px",
            lineHeight: 1.6,
          }}
        >
          Tips for Chicago renters on building violations, tenant rights, and
          finding safe housing.
        </p>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "#57606a",
              fontSize: 14,
            }}
          >
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <p style={{ fontSize: 15, color: "#57606a", margin: 0 }}>
              No blog posts yet. Check back soon!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {posts.map((post) => (
              <a
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  display: "block",
                  padding: "24px 28px",
                  border: "1px solid #e8ecf0",
                  borderRadius: 8,
                  background: "#fff",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0,0,0,0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.boxShadow = "none")
                }
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#8b949e",
                    marginBottom: 8,
                  }}
                >
                  {formatDate(post.created_at)}
                </div>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#1f2328",
                    margin: "0 0 8px",
                  }}
                >
                  {post.title}
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "#57606a",
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {post.excerpt}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    fontSize: 13,
                    color: "#1f6feb",
                    fontWeight: 600,
                  }}
                >
                  Read more →
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 680, margin: "24px auto 0", padding: "0 20px", textAlign: "center" }}>
        <ins className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-1105551881353525"
          data-ad-slot="auto"
          data-ad-format="auto"
          data-full-width-responsive="true" />
        <script dangerouslySetInnerHTML={{ __html: "(adsbygoogle = window.adsbygoogle || []).push({});" }} />
      </div>

      <NewsletterSignup />

      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "0 20px",
          marginTop: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            background: "#f0f6ff",
            borderRadius: 8,
            border: "1px solid #d0e0ff",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: "#424a53",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Know something about your building or landlord?{" "}
            <a
              href="/"
              style={{
                color: "#1f6feb",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Leave a review
            </a>{" "}
            and help Chicago renters stay informed.
          </p>
        </div>
      </div>

      <footer
        style={{
          textAlign: "center",
          padding: "36px 20px",
          borderTop: "1px solid #e8ecf0",
          marginTop: 40,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 13, color: "#8b949e" }}>
          TenantShield · Protecting Chicago renters · 2026
        </div>
      </footer>
    </div>
  );
}
