"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";

export default function LandlordSignup() {
  const auth = useAuth();
  const [profile, setProfile] = useState<{ id: string } | null | undefined>(
    undefined
  );
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing landlord profile when user is available
  useEffect(() => {
    if (auth.loading || !auth.user) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.from("landlord_profiles")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          window.location.href = "/landlord/dashboard";
        } else {
          setProfile(null);
          setContactEmail(auth.user!.email || "");
        }
      });
  }, [auth.loading, auth.user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) return;
    const sb = getSupabase();
    if (!sb) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await sb.from("landlord_profiles").insert({
      user_id: auth.user.id,
      company_name: companyName.trim() || null,
      contact_email: contactEmail.trim(),
      phone: phone.trim() || null,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else {
      window.location.href = "/landlord/dashboard";
    }
  }

  // Loading state
  if (auth.loading || (auth.user && profile === undefined)) {
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

  // Not logged in — show sign-in prompt
  if (!auth.user) {
    return (
      <div style={pageStyle}>
        <Nav />
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "64px 20px" }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              padding: "48px 36px",
              textAlign: "center",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1f6feb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 20 }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 12px",
              }}
            >
              Landlord Portal
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "#57606a",
                margin: "0 0 8px",
                lineHeight: 1.6,
              }}
            >
              Claim your buildings, monitor violations, and respond to tenant
              concerns — all in one place.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#8b949e",
                margin: "0 0 32px",
                lineHeight: 1.5,
              }}
            >
              Sign in with Google to get started. Your free account includes up
              to 3 buildings.
            </p>
            <button
              onClick={() => auth.signInWithGoogle()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 28px",
                background: "#fff",
                border: "1px solid #d0d7de",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                color: "#1f2328",
                cursor: "pointer",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Sign in with Google
            </button>
            {auth.error && (
              <p style={{ color: "#cf222e", fontSize: 13, marginTop: 16 }}>
                {auth.error}
              </p>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Logged in, no profile — show signup form
  return (
    <div style={pageStyle}>
      <Nav />
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1f2328",
            margin: "0 0 8px",
          }}
        >
          Complete Your Profile
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#57606a",
            margin: "0 0 28px",
            lineHeight: 1.6,
          }}
        >
          Tell us a bit about yourself so we can set up your landlord dashboard.
        </p>
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#fff",
            border: "1px solid #e8ecf0",
            borderRadius: 8,
            padding: "32px 28px",
          }}
        >
          <label style={labelStyle}>
            Company or Full Name
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Skyline Properties LLC"
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            Contact Email
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            Phone (optional)
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(312) 555-0100"
              style={inputStyle}
            />
          </label>
          {error && (
            <p style={{ color: "#cf222e", fontSize: 13, margin: "0 0 16px" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "12px 0",
              background: submitting ? "#80b3f5" : "#1f6feb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Creating account..." : "Create Landlord Account"}
          </button>
        </form>
      </div>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared sub-components & styles                                     */
/* ------------------------------------------------------------------ */

function Nav() {
  return (
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
        Back to Home
      </a>
    </nav>
  );
}

function Footer() {
  return (
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
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f8fa",
  color: "#1f2328",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#1f2328",
  marginBottom: 18,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  border: "1px solid #d0d7de",
  borderRadius: 6,
  fontSize: 14,
  color: "#1f2328",
  background: "#fff",
  boxSizing: "border-box",
};
