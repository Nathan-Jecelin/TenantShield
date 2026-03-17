"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Nav,
  Footer,
  pageStyle,
  labelStyle,
  inputStyle,
  primaryButtonStyle,
  cardStyle,
  linkStyle,
} from "@/components/landlord-shared";

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    auth.clearError();
    const ok = await auth.resetPassword(email);
    if (ok) setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div style={pageStyle}>
      <Nav />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "64px 20px" }}>
        <div style={cardStyle}>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1a7f37"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 16 }}
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#1f2328",
                  margin: "0 0 8px",
                }}
              >
                Check your email
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "#57606a",
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                We sent a password reset link to{" "}
                <strong style={{ color: "#1f2328" }}>{email}</strong>. Click the
                link in the email to set a new password.
              </p>
              <a href="/landlord/login" style={linkStyle}>
                Back to login
              </a>
            </div>
          ) : (
            <>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#1f2328",
                  margin: "0 0 8px",
                  textAlign: "center",
                }}
              >
                Reset your password
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "#57606a",
                  margin: "0 0 28px",
                  textAlign: "center",
                  lineHeight: 1.6,
                }}
              >
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </p>

              <form onSubmit={handleSubmit}>
                <label style={labelStyle}>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={inputStyle}
                    required
                  />
                </label>

                {auth.error && (
                  <p
                    style={{
                      color: "#cf222e",
                      fontSize: 13,
                      margin: "0 0 16px",
                    }}
                  >
                    {auth.error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...primaryButtonStyle,
                    background: submitting ? "#80b3f5" : "#1f6feb",
                    cursor: submitting ? "default" : "pointer",
                  }}
                >
                  {submitting ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#57606a",
            marginTop: 24,
          }}
        >
          Remember your password?{" "}
          <a href="/landlord/login" style={linkStyle}>
            Log in
          </a>
        </p>
      </div>
      <Footer />
    </div>
  );
}
