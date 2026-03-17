"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import {
  Nav,
  Footer,
  GoogleOAuthButton,
  Divider,
  pageStyle,
  labelStyle,
  inputStyle,
  primaryButtonStyle,
  cardStyle,
  linkStyle,
} from "@/components/landlord-shared";

export default function LandlordLogin() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check URL params for success messages (e.g. after password reset)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "success") {
      setSuccessMsg("Password updated successfully. Please log in.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // If already logged in, redirect
  useEffect(() => {
    if (auth.loading || !auth.user) return;
    redirectAfterLogin(auth.user.id);
  }, [auth.loading, auth.user]);

  async function redirectAfterLogin(userId: string) {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb
      .from("landlord_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      window.location.href = "/landlord/dashboard";
    } else {
      window.location.href = "/landlord/signup";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    auth.clearError();
    const ok = await auth.signIn(email, password);
    if (ok && auth.user) {
      await redirectAfterLogin(auth.user.id);
    }
    setSubmitting(false);
  }

  if (auth.loading) {
    return (
      <div style={pageStyle}>
        <Nav />
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            color: "#57606a",
            fontSize: 14,
          }}
        >
          Loading...
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Nav />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "64px 20px" }}>
        <div style={cardStyle}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1f2328",
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            Log in to TenantShield
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#57606a",
              margin: "0 0 28px",
              textAlign: "center",
            }}
          >
            Access your landlord dashboard
          </p>

          {successMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: "#dafbe1",
                border: "1px solid #a7f3d0",
                borderRadius: 6,
                fontSize: 13,
                color: "#1a7f37",
                marginBottom: 20,
              }}
            >
              {successMsg}
            </div>
          )}

          <GoogleOAuthButton onClick={() => auth.signInWithGoogle()} />

          <Divider />

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
            <label style={labelStyle}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 18,
                marginTop: -10,
              }}
            >
              <a href="/landlord/forgot-password" style={linkStyle}>
                Forgot password?
              </a>
            </div>

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
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#57606a",
            marginTop: 24,
          }}
        >
          Don&apos;t have an account?{" "}
          <a href="/landlord/signup" style={linkStyle}>
            Sign up
          </a>
        </p>
      </div>
      <Footer />
    </div>
  );
}
