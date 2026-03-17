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

type View = "signup" | "verify-pending" | "complete-profile";

export default function LandlordSignup() {
  const auth = useAuth();
  const [view, setView] = useState<View>("signup");

  // Signup form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Profile completion fields (for Google OAuth users who don't have a profile yet)
  const [profileCompany, setProfileCompany] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check existing profile when user is authenticated (Google OAuth flow)
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
          setView("complete-profile");
          setContactEmail(auth.user!.email || "");
        }
      });
  }, [auth.loading, auth.user]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    auth.clearError();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }

    const ok = await auth.signUp(email, password, {
      company_name: companyName,
    });
    if (ok) {
      setView("verify-pending");
    }
    setSubmitting(false);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) return;
    const sb = getSupabase();
    if (!sb) return;
    setProfileSubmitting(true);
    setError(null);
    const { error: err } = await sb.from("landlord_profiles").insert({
      user_id: auth.user.id,
      company_name: profileCompany.trim() || null,
      contact_email: contactEmail.trim(),
      phone: phone.trim() || null,
    });
    if (err) {
      setError(err.message);
      setProfileSubmitting(false);
    } else {
      window.location.href = "/landlord/dashboard";
    }
  }

  // Loading state
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

  // Email verification pending screen
  if (view === "verify-pending") {
    return (
      <div style={pageStyle}>
        <Nav />
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "64px 20px" }}>
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1f6feb"
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
                margin: "0 0 8px",
                lineHeight: 1.6,
              }}
            >
              We sent a verification link to{" "}
              <strong style={{ color: "#1f2328" }}>{email}</strong>.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#8b949e",
                margin: "0 0 24px",
                lineHeight: 1.5,
              }}
            >
              Click the link in the email to verify your account and access your
              dashboard.
            </p>
            <button
              onClick={async () => {
                auth.clearError();
                setError(null);
                const ok = await auth.signUp(email, password, {
                  company_name: companyName,
                });
                if (!ok) {
                  setError(auth.error || "Failed to resend. Please try again.");
                }
              }}
              style={{
                background: "none",
                border: "1px solid #d0d7de",
                borderRadius: 6,
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                color: "#57606a",
                cursor: "pointer",
              }}
            >
              Resend email
            </button>
            {(auth.error || error) && (
              <p
                style={{
                  color: "#cf222e",
                  fontSize: 13,
                  marginTop: 12,
                }}
              >
                {auth.error || error}
              </p>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Complete profile (Google OAuth users without a profile)
  if (view === "complete-profile" && auth.user) {
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
            Tell us a bit about yourself so we can set up your landlord
            dashboard.
          </p>
          <form
            onSubmit={handleProfileSubmit}
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
                value={profileCompany}
                onChange={(e) => setProfileCompany(e.target.value)}
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
              <p
                style={{ color: "#cf222e", fontSize: 13, margin: "0 0 16px" }}
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={profileSubmitting}
              style={{
                ...primaryButtonStyle,
                background: profileSubmitting ? "#80b3f5" : "#1f6feb",
                cursor: profileSubmitting ? "default" : "pointer",
              }}
            >
              {profileSubmitting
                ? "Creating account..."
                : "Create Landlord Account"}
            </button>
          </form>
        </div>
        <Footer />
      </div>
    );
  }

  // Default: signup form
  return (
    <div style={pageStyle}>
      <Nav />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "64px 20px" }}>
        <div style={cardStyle}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1f6feb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "block", margin: "0 auto 20px" }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1f2328",
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            Landlord Portal
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#57606a",
              margin: "0 0 8px",
              textAlign: "center",
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
              margin: "0 0 28px",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Create your free account to get started. Includes up to 3 buildings.
          </p>

          <GoogleOAuthButton onClick={() => auth.signInWithGoogle()} />

          <Divider />

          <form onSubmit={handleSignup}>
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
                placeholder="At least 8 characters"
                style={inputStyle}
                required
                minLength={8}
              />
            </label>

            {(auth.error || error) && (
              <p
                style={{
                  color: "#cf222e",
                  fontSize: 13,
                  margin: "0 0 16px",
                }}
              >
                {auth.error || error}
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
              {submitting ? "Creating account..." : "Create Account"}
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
          Already have an account?{" "}
          <a href="/landlord/login" style={linkStyle}>
            Log in
          </a>
        </p>
      </div>
      <Footer />
    </div>
  );
}
