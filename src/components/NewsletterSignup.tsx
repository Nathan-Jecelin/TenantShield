"use client";

import { useState } from "react";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div
      style={{
        background: "#f0f6ff",
        borderRadius: 8,
        padding: "28px 24px",
        margin: "32px 0",
        textAlign: "center",
      }}
    >
      <h3
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "#1f2328",
          margin: "0 0 6px",
        }}
      >
        Stay in the loop
      </h3>
      <p
        style={{
          fontSize: 13,
          color: "#57606a",
          margin: "0 0 16px",
          lineHeight: 1.5,
        }}
      >
        Get weekly updates on new reviews, blog posts, and Chicago renter news.
      </p>

      {status === "success" ? (
        <p style={{ fontSize: 14, color: "#1a7f37", fontWeight: 600 }}>
          {message}
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 8,
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="you@example.com"
            required
            style={{
              flex: 1,
              padding: "9px 12px",
              border: "1px solid #d1d9e0",
              borderRadius: 6,
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              background: "#fff",
            }}
          />
          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              padding: "9px 20px",
              background: "#1f6feb",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: status === "loading" ? "default" : "pointer",
              opacity: status === "loading" ? 0.7 : 1,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {status === "loading" ? "..." : "Subscribe"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p style={{ fontSize: 13, color: "#cf222e", marginTop: 8 }}>
          {message}
        </p>
      )}
    </div>
  );
}
