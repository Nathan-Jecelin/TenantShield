"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";

interface LandlordProfile {
  id: string;
  company_name: string | null;
  contact_email: string | null;
  plan: string;
  plan_status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  verified: boolean;
}

export default function LandlordSettings() {
  const auth = useAuth();
  const [profile, setProfile] = useState<LandlordProfile | null | undefined>(undefined);
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const loadData = useCallback(async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: prof } = await sb
      .from("landlord_profiles")
      .select("id, company_name, contact_email, plan, plan_status, current_period_end, stripe_customer_id, verified")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) {
      window.location.href = "/landlord/signup";
      return;
    }
    setProfile(prof);
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      window.location.href = "/landlord/signup";
      return;
    }
    loadData(auth.user.id);
  }, [auth.loading, auth.user, loadData]);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setUpgrading(false);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPortalLoading(false);
    }
  }

  if (auth.loading || (auth.user && profile === undefined)) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Loading settings...</div>
        <Footer />
      </div>
    );
  }

  if (!auth.user || !profile) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Redirecting...</div>
        <Footer />
      </div>
    );
  }

  const isPro = profile.plan === "pro";

  return (
    <div style={pageStyle}>
      <DashNav onLogout={auth.signOut} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px" }}>
        <a
          href="/landlord/dashboard"
          style={{
            fontSize: 13,
            color: "#1f6feb",
            textDecoration: "none",
            fontWeight: 600,
            display: "inline-block",
            marginBottom: 20,
          }}
        >
          &larr; Back to Dashboard
        </a>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2328", margin: "0 0 24px" }}>
          Settings
        </h1>

        {/* Billing section */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: "0 0 16px" }}>
            Billing &amp; Subscription
          </h2>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              background: isPro ? "linear-gradient(135deg, #dbeafe 0%, #d1fae5 100%)" : "#f6f8fa",
              borderRadius: 8,
              border: isPro ? "1px solid #93c5fd" : "1px solid #e8ecf0",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isPro ? "#1e40af" : "#57606a",
                  }}
                >
                  {isPro ? "Pro Plan" : "Free Plan"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: isPro ? "#bfdbfe" : "#e8ecf0",
                    color: isPro ? "#1e40af" : "#57606a",
                  }}
                >
                  {isPro ? "$49/mo" : "$0/mo"}
                </span>
              </div>
              {isPro && profile.current_period_end && (
                <p style={{ fontSize: 12, color: "#57606a", margin: 0 }}>
                  Next billing date: {new Date(profile.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
              {isPro && profile.plan_status === "past_due" && (
                <p style={{ fontSize: 12, color: "#cf222e", margin: "4px 0 0", fontWeight: 600 }}>
                  Payment past due — please update your billing info.
                </p>
              )}
              {!isPro && (
                <p style={{ fontSize: 12, color: "#57606a", margin: 0 }}>
                  1 building, violations, complaints, building score
                </p>
              )}
            </div>

            {isPro ? (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                style={{
                  padding: "8px 18px",
                  background: "none",
                  border: "1px solid #d0d7de",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#57606a",
                  cursor: "pointer",
                  opacity: portalLoading ? 0.7 : 1,
                }}
              >
                {portalLoading ? "Loading..." : "Manage Billing"}
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                style={{
                  padding: "8px 18px",
                  background: "#1f6feb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: upgrading ? 0.7 : 1,
                }}
              >
                {upgrading ? "Loading..." : "Upgrade to Pro — $49/mo"}
              </button>
            )}
          </div>

          {/* Feature comparison */}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#57606a", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Plan Features
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0", fontSize: 13 }}>
              <div style={featureHeaderStyle}>Feature</div>
              <div style={{ ...featureHeaderStyle, textAlign: "center" }}>Free</div>
              <div style={{ ...featureHeaderStyle, textAlign: "center" }}>Pro</div>

              <FeatureRow label="View violations" free pro />
              <FeatureRow label="View complaints" free pro />
              <FeatureRow label="Building score" free pro />
              <FeatureRow label="Claim buildings" free="1" pro="Unlimited" />
              <FeatureRow label="Alerts" pro />
              <FeatureRow label="Respond to violations" pro />
              <FeatureRow label="Verified badge" pro />
              <FeatureRow label="Neighborhood benchmarks" pro />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function FeatureRow({ label, free, pro }: { label: string; free?: boolean | string; pro?: boolean | string }) {
  return (
    <>
      <div style={featureCellStyle}>{label}</div>
      <div style={{ ...featureCellStyle, textAlign: "center" }}>
        {free === true ? "✓" : free === false || free === undefined ? "—" : free}
      </div>
      <div style={{ ...featureCellStyle, textAlign: "center", color: pro ? "#1a7f37" : "#8b949e" }}>
        {pro === true ? "✓" : pro === false || pro === undefined ? "—" : pro}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DashNav({ onLogout }: { onLogout: () => void }) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a
          href="/landlord/dashboard"
          style={{
            fontSize: 13,
            color: "#1f6feb",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Dashboard
        </a>
        <a
          href="/landlord/dashboard/settings"
          style={{
            fontSize: 13,
            color: "#1f6feb",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Settings
        </a>
        <button
          onClick={onLogout}
          style={{
            padding: "6px 14px",
            background: "none",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#57606a",
            cursor: "pointer",
          }}
        >
          Log Out
        </button>
      </div>
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

/* ------------------------------------------------------------------ */
/* Shared styles                                                      */
/* ------------------------------------------------------------------ */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f8fa",
  color: "#1f2328",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

const loadingStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "80px 0",
  color: "#57606a",
  fontSize: 14,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e8ecf0",
  borderRadius: 8,
  padding: "20px 24px",
};

const featureHeaderStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 600,
  color: "#57606a",
  borderBottom: "1px solid #e8ecf0",
};

const featureCellStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #f0f3f6",
  color: "#1f2328",
};
