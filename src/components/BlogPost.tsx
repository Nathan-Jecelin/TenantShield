"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

interface Post {
  title: string;
  content: string;
  excerpt: string;
  created_at: string;
  updated_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogPost({ slug }: { slug: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    sb.from("blog_posts")
      .select("title, content, excerpt, created_at, updated_at")
      .eq("slug", slug)
      .eq("published", true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setPost(data);
        }
        setLoading(false);
      });
  }, [slug]);

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
          href="/blog"
          style={{
            fontSize: 13,
            color: "#1f6feb",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← All Posts
        </a>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 20px" }}>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "#57606a",
              fontSize: 14,
            }}
          >
            Loading...
          </div>
        ) : notFound ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 8px",
              }}
            >
              Post not found
            </h1>
            <p style={{ fontSize: 14, color: "#57606a", margin: "0 0 16px" }}>
              This blog post doesn&apos;t exist or has been removed.
            </p>
            <a
              href="/blog"
              style={{
                fontSize: 14,
                color: "#1f6feb",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Back to blog
            </a>
          </div>
        ) : post ? (
          <article
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              padding: "40px 36px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#8b949e",
                marginBottom: 12,
              }}
            >
              {formatDate(post.created_at)}
              {post.updated_at !== post.created_at && (
                <span> · Updated {formatDate(post.updated_at)}</span>
              )}
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 24px",
                lineHeight: 1.3,
              }}
            >
              {post.title}
            </h1>
            <div
              style={{
                fontSize: 15,
                lineHeight: 1.8,
                color: "#424a53",
              }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
            <div
              style={{
                marginTop: 36,
                paddingTop: 24,
                borderTop: "1px solid #e8ecf0",
              }}
            >
              <a
                href="/blog"
                style={{
                  fontSize: 14,
                  color: "#1f6feb",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                ← Back to all posts
              </a>
            </div>
          </article>
        ) : null}
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
