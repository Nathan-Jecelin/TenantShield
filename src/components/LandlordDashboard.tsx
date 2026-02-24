"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import {
  searchAddresses,
  parseStreetAddress,
  generateAddressVariants,
  fetchBuildingViolations,
  fetchServiceRequests,
  fetchBuildingPermits,
} from "@/lib/chicagoData";
import { addressToSlug } from "@/lib/slugs";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface LandlordProfile {
  id: string;
  company_name: string | null;
  contact_email: string | null;
  plan: string;
  verified: boolean;
}

interface ClaimedBuilding {
  id: string;
  address: string;
  verification_status: string;
  claimant_role: string;
  units: number | null;
  claimed_at: string;
}

interface LandlordAlert {
  id: string;
  alert_type: string;
  title: string;
  severity: string;
  read: boolean;
  created_at: string;
}

interface PreviewData {
  violations: number;
  complaints: number;
  permits: number;
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function LandlordDashboard() {
  const auth = useAuth();
  const [profile, setProfile] = useState<LandlordProfile | null | undefined>(
    undefined
  );
  const [buildings, setBuildings] = useState<ClaimedBuilding[]>([]);
  const [alerts, setAlerts] = useState<LandlordAlert[]>([]);

  // Claim flow state
  const [claimMode, setClaimMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [claimRole, setClaimRole] = useState("owner");
  const [claimUnits, setClaimUnits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ---- Load profile, buildings, alerts ---- */
  const loadData = useCallback(
    async (userId: string) => {
      const sb = getSupabase();
      if (!sb) return;
      const { data: prof } = await sb
        .from("landlord_profiles")
        .select("id, company_name, contact_email, plan, verified")
        .eq("user_id", userId)
        .maybeSingle();
      if (!prof) {
        window.location.href = "/landlord/signup";
        return;
      }
      setProfile(prof);

      const [{ data: bldgs }, { data: alts }] = await Promise.all([
        sb
          .from("claimed_buildings")
          .select(
            "id, address, verification_status, claimant_role, units, claimed_at"
          )
          .eq("landlord_id", prof.id)
          .order("claimed_at", { ascending: false }),
        sb
          .from("landlord_alerts")
          .select("id, alert_type, title, severity, read, created_at")
          .eq("landlord_id", prof.id)
          .order("read", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (bldgs) setBuildings(bldgs);
      if (alts) setAlerts(alts);
    },
    []
  );

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      window.location.href = "/landlord/signup";
      return;
    }
    loadData(auth.user.id);
  }, [auth.loading, auth.user, loadData]);

  /* ---- Address search with debounce ---- */
  useEffect(() => {
    if (searchQuery.length < 4) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddresses(searchQuery);
        // deduplicate
        setSearchResults([...new Set(results)]);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* ---- Preview fetch ---- */
  async function handleSelectAddress(addr: string) {
    setPreviewAddress(addr);
    setPreviewData(null);
    setPreviewLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const parsed = parseStreetAddress(addr);
      const variants = parsed ? generateAddressVariants(parsed) : [addr];
      const [violations, complaints, permits] = await Promise.all([
        fetchBuildingViolations(variants),
        fetchServiceRequests(variants),
        fetchBuildingPermits(variants),
      ]);
      setPreviewData({
        violations: violations.length,
        complaints: complaints.length,
        permits: permits.length,
      });
    } catch {
      setPreviewData({ violations: 0, complaints: 0, permits: 0 });
    }
    setPreviewLoading(false);
  }

  /* ---- Submit claim ---- */
  async function handleClaimSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !previewAddress) return;
    const sb = getSupabase();
    if (!sb) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await sb.from("claimed_buildings").insert({
      landlord_id: profile.id,
      address: previewAddress,
      claimant_role: claimRole,
      units: claimUnits ? parseInt(claimUnits, 10) : null,
      verification_status: "pending",
    });
    if (err) {
      setError(
        err.code === "23505"
          ? "You have already claimed this building."
          : err.message
      );
      setSubmitting(false);
    } else {
      setSubmitting(false);
      setClaimMode(false);
      setSearchQuery("");
      setSearchResults([]);
      setPreviewAddress(null);
      setPreviewData(null);
      setClaimRole("owner");
      setClaimUnits("");
      setSuccessMsg("Building claimed! Verification is pending.");
      loadData(auth.user!.id);
    }
  }

  /* ---- Derived stats ---- */
  const pendingCount = buildings.filter(
    (b) => b.verification_status === "pending"
  ).length;

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  // Loading
  if (auth.loading || (auth.user && profile === undefined)) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Loading dashboard...</div>
        <Footer />
      </div>
    );
  }

  // No auth (should redirect, but safety fallback)
  if (!auth.user || !profile) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Redirecting...</div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <DashNav onLogout={auth.signOut} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px" }}>
        {/* Profile header */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#1f2328",
                  margin: "0 0 4px",
                }}
              >
                {profile.company_name || "My Dashboard"}
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: "#57606a",
                  margin: 0,
                }}
              >
                {profile.contact_email}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={badgeStyle("#d0e0ff", "#1f6feb")}>
                {profile.plan === "free"
                  ? "Free"
                  : profile.plan === "basic"
                    ? "Basic"
                    : "Pro"}
              </span>
              {profile.verified && (
                <span style={badgeStyle("#dafbe1", "#1a7f37")}>Verified</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            margin: "20px 0",
          }}
        >
          <StatCard label="Buildings" value={buildings.length} />
          <StatCard label="Pending Claims" value={pendingCount} />
          <StatCard label="Alerts" value={alerts.length} />
        </div>

        {/* Success message */}
        {successMsg && (
          <div
            style={{
              padding: "12px 16px",
              background: "#dafbe1",
              border: "1px solid #a7f3d0",
              borderRadius: 6,
              fontSize: 14,
              color: "#1a7f37",
              marginBottom: 20,
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Buildings section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2
            style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: 0 }}
          >
            Your Buildings
          </h2>
          {!claimMode && (
            <button
              onClick={() => {
                setClaimMode(true);
                setSuccessMsg(null);
              }}
              style={primaryBtnStyle}
            >
              + Claim a Building
            </button>
          )}
        </div>

        {buildings.length === 0 && !claimMode ? (
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              padding: "40px 24px",
            }}
          >
            <p
              style={{ fontSize: 15, color: "#57606a", margin: "0 0 4px" }}
            >
              No buildings claimed yet.
            </p>
            <p style={{ fontSize: 13, color: "#8b949e", margin: 0 }}>
              Click &ldquo;Claim a Building&rdquo; to get started.
            </p>
          </div>
        ) : (
          <div style={cardStyle}>
            {buildings.map((b, i) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 0",
                  borderTop: i > 0 ? "1px solid #e8ecf0" : "none",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <a
                    href={`/address/${addressToSlug(b.address)}`}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1f6feb",
                      textDecoration: "none",
                    }}
                  >
                    {b.address}
                  </a>
                  <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>
                    {roleLabel(b.claimant_role)}
                    {b.units ? ` · ${b.units} units` : ""}
                    {" · "}
                    {formatDate(b.claimed_at)}
                  </div>
                </div>
                <StatusBadge status={b.verification_status} />
              </div>
            ))}
          </div>
        )}

        {/* Claim flow (inline) */}
        {claimMode && (
          <div style={{ ...cardStyle, marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1f2328",
                  margin: 0,
                }}
              >
                Claim a Building
              </h3>
              <button
                onClick={() => {
                  setClaimMode(false);
                  setSearchQuery("");
                  setSearchResults([]);
                  setPreviewAddress(null);
                  setPreviewData(null);
                  setError(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 13,
                  color: "#57606a",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>

            {/* Search input */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPreviewAddress(null);
                  setPreviewData(null);
                  setError(null);
                }}
                placeholder="Search by address, e.g. 1550 N Lake Shore Dr"
                style={{
                  ...inputStyle,
                  marginTop: 0,
                }}
              />
              {searching && (
                <div
                  style={{
                    position: "absolute",
                    right: 12,
                    top: 11,
                    fontSize: 12,
                    color: "#8b949e",
                  }}
                >
                  Searching...
                </div>
              )}
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && !previewAddress && (
              <div
                style={{
                  border: "1px solid #e8ecf0",
                  borderRadius: 6,
                  background: "#fff",
                  maxHeight: 200,
                  overflowY: "auto",
                  marginBottom: 16,
                }}
              >
                {searchResults.map((addr) => (
                  <button
                    key={addr}
                    onClick={() => handleSelectAddress(addr)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      border: "none",
                      borderBottom: "1px solid #f0f0f0",
                      background: "none",
                      fontSize: 13,
                      color: "#1f2328",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f6f8fa")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    {addr}
                  </button>
                ))}
              </div>
            )}

            {/* Preview card */}
            {previewAddress && (
              <div
                style={{
                  background: "#f6f8fa",
                  border: "1px solid #e8ecf0",
                  borderRadius: 6,
                  padding: "16px 20px",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#1f2328",
                    marginBottom: 10,
                  }}
                >
                  {previewAddress}
                </div>
                {previewLoading ? (
                  <div style={{ fontSize: 13, color: "#57606a" }}>
                    Loading building data...
                  </div>
                ) : previewData ? (
                  <div
                    style={{ display: "flex", gap: 20, flexWrap: "wrap" }}
                  >
                    <PreviewStat
                      label="Violations"
                      value={previewData.violations}
                      warn={previewData.violations > 0}
                    />
                    <PreviewStat
                      label="311 Complaints"
                      value={previewData.complaints}
                      warn={previewData.complaints > 0}
                    />
                    <PreviewStat
                      label="Permits"
                      value={previewData.permits}
                      warn={false}
                    />
                    <div style={{ width: "100%" }}>
                      {previewData.violations === 0 &&
                      previewData.complaints === 0 ? (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#1a7f37",
                            fontWeight: 600,
                          }}
                        >
                          Clean record
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#9a6700",
                            fontWeight: 600,
                          }}
                        >
                          Issues found — claim to monitor and respond
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Claim form */}
            {previewAddress && previewData && (
              <form onSubmit={handleClaimSubmit}>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 16,
                  }}
                >
                  <label style={{ ...labelStyle, flex: 1, minWidth: 180 }}>
                    Your Role
                    <select
                      value={claimRole}
                      onChange={(e) => setClaimRole(e.target.value)}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="owner">Owner</option>
                      <option value="property_manager">
                        Property Manager
                      </option>
                      <option value="management_company">
                        Management Company
                      </option>
                    </select>
                  </label>
                  <label style={{ ...labelStyle, flex: 1, minWidth: 120 }}>
                    Units (optional)
                    <input
                      type="number"
                      min="1"
                      value={claimUnits}
                      onChange={(e) => setClaimUnits(e.target.value)}
                      placeholder="e.g. 12"
                      style={inputStyle}
                    />
                  </label>
                </div>
                {error && (
                  <p
                    style={{
                      color: "#cf222e",
                      fontSize: 13,
                      margin: "0 0 12px",
                    }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...primaryBtnStyle,
                    width: "100%",
                    padding: "12px 0",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Claim"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Alerts section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "32px 0 12px",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#1f2328",
              margin: 0,
            }}
          >
            Recent Alerts
          </h2>
          <a
            href="/landlord/dashboard/alerts"
            style={{
              fontSize: 13,
              color: "#1f6feb",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            View All Alerts &rarr;
          </a>
        </div>
        {alerts.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              padding: "32px 24px",
            }}
          >
            <p style={{ fontSize: 14, color: "#57606a", margin: 0 }}>
              No alerts yet. Alerts will appear when activity is detected on
              your buildings.
            </p>
          </div>
        ) : (
          <div style={cardStyle}>
            {alerts.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderTop: i > 0 ? "1px solid #e8ecf0" : "none",
                  opacity: a.read ? 0.7 : 1,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertIcon type={a.alert_type} />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: a.read ? 400 : 600,
                        color: "#1f2328",
                      }}
                    >
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                      {formatDate(a.created_at)}
                    </div>
                  </div>
                </div>
                <SeverityBadge severity={a.severity} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8ecf0",
        borderRadius: 8,
        padding: "20px 16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#1f2328",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#57606a", marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "#fff8c5", fg: "#9a6700" },
    approved: { bg: "#dafbe1", fg: "#1a7f37" },
    rejected: { bg: "#ffebe9", fg: "#cf222e" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={badgeStyle(s.bg, s.fg)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    high: { bg: "#ffebe9", fg: "#cf222e" },
    medium: { bg: "#fff8c5", fg: "#9a6700" },
    low: { bg: "#dafbe1", fg: "#1a7f37" },
  };
  const s = styles[severity] || styles.medium;
  return <span style={badgeStyle(s.bg, s.fg)}>{severity}</span>;
}

function AlertIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    violation: "V",
    "311_complaint": "C",
    review: "R",
  };
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#f0f6ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        color: "#1f6feb",
        flexShrink: 0,
      }}
    >
      {icons[type] || "?"}
    </div>
  );
}

function PreviewStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: warn ? "#9a6700" : "#1f2328",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#57606a" }}>{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    owner: "Owner",
    property_manager: "Property Manager",
    management_company: "Management Co.",
  };
  return map[role] || role;
}

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color: fg,
  };
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

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 18px",
  background: "#1f6feb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#1f2328",
  marginBottom: 0,
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
