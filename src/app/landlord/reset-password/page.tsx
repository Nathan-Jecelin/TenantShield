"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  Nav,
  Footer,
  pageStyle,
  labelStyle,
  inputStyle,
  primaryButtonStyle,
  cardStyle,
} from "@/components/landlord-shared";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Supabase handles the token exchange via the URL hash automatically
  // when onAuthStateChange fires PASSWORD_RECOVERY event
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check if session already exists (user may have already been authenticated by token)
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const sb = getSupabase();
    if (!sb) return;
    const { error: err } = await sb.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else {
      window.location.href = "/landlord/login?reset=success";
    }
  }

  return (
    <div style={pageStyle}>
      <Nav />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "64px 20px" }}>
        <div style={cardStyle}>
          {!ready ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#57606a" }}>
                Verifying reset link...
              </p>
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
                Set a new password
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "#57606a",
                  margin: "0 0 28px",
                  textAlign: "center",
                }}
              >
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit}>
                <label style={labelStyle}>
                  New Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={inputStyle}
                    required
                    minLength={8}
                  />
                </label>
                <label style={labelStyle}>
                  Confirm Password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={inputStyle}
                    required
                    minLength={8}
                  />
                </label>

                {error && (
                  <p
                    style={{
                      color: "#cf222e",
                      fontSize: 13,
                      margin: "0 0 16px",
                    }}
                  >
                    {error}
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
                  {submitting ? "Updating..." : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
