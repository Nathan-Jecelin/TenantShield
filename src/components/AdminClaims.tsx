"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Constants & Types                                                   */
/* ------------------------------------------------------------------ */

const ADMIN_EMAIL = "njecelin17@gmail.com";

type FilterStatus = "pending" | "approved" | "rejected" | "all";

interface Claim {
  id: string;
  address: string;
  verification_status: string;
  claimant_role: string;
  units: number | null;
  claimed_at: string;
  landlord_profiles: {
    company_name: string | null;
    contact_email: string | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function AdminClaims() {
  const auth = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const isAdmin =
    !auth.loading && auth.user?.email === ADMIN_EMAIL;

  /* ---- Fetch all claims ---- */
  const loadClaims = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    const { data } = await sb
      .from("claimed_buildings")
      .select(
        "id, address, verification_status, claimant_role, units, claimed_at, landlord_profiles(company_name, contact_email)"
      )
      .order("claimed_at", { ascending: false });
    if (data) setClaims(data as unknown as Claim[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!auth.loading && isAdmin) loadClaims();
    if (!auth.loading && !isAdmin) setLoading(false);
  }, [auth.loading, isAdmin, loadClaims]);

  /* ---- Update claim status ---- */
  async function handleStatusChange(claimId: string, newStatus: string) {
    const sb = getSupabase();
    if (!sb) return;
    setUpdating(claimId);
    await sb
      .from("claimed_buildings")
      .update({ verification_status: newStatus })
      .eq("id", claimId);
    await loadClaims();
    setUpdating(null);
  }

  /* ---- Filtered list ---- */
  const filtered =
    filter === "all"
      ? claims
      : claims.filter((c) => c.verification_status === filter);

  const counts = {
    pending: claims.filter((c) => c.verification_status === "pending").length,
    approved: claims.filter((c) => c.verification_status === "approved").length,
    rejected: claims.filter((c) => c.verification_status === "rejected").length,
    all: claims.length,
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  // Loading
  if (auth.loading || (isAdmin && loading)) {
    return (
      <div style={pageStyle}>
        <Nav />
        <div style={centerMsg}>Loading...</div>
        <Footer />
      </div>
    );
  }

  // Unauthorized
  if (!isAdmin) {
    return (
      <div style={pageStyle}>
        <Nav />
        <div style={centerMsg}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1f2328", margin: "0 0 8px" }}>
            Unauthorized
          </h2>
          <p style={{ fontSize: 14, color: "#57606a", margin: 0 }}>
            You do not have permission to view this page.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Nav />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 20px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2328", margin: "0 0 4px" }}>
          Building Claims Review
        </h1>
        <p style={{ fontSize: 13, color: "#57606a", margin: "0 0 24px" }}>
          Approve or reject landlord building claims.
        </p>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {(["pending", "approved", "rejected", "all"] as FilterStatus[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: filter === f ? "none" : "1px solid #d0d7de",
                  background: filter === f ? "#1f6feb" : "#fff",
                  color: filter === f ? "#fff" : "#57606a",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
              </button>
            )
          )}
        </div>

        {/* Claims list */}
        {filtered.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px" }}>
            <p style={{ fontSize: 14, color: "#57606a", margin: 0 }}>
              No {filter === "all" ? "" : filter + " "}claims found.
            </p>
          </div>
        ) : (
          <div style={cardStyle}>
            {filtered.map((c, i) => {
              const lp = c.landlord_profiles;
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 0",
                    borderTop: i > 0 ? "1px solid #e8ecf0" : "none",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {/* Left: info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2328" }}>
                      {c.address}
                    </div>
                    <div style={{ fontSize: 12, color: "#57606a", marginTop: 3 }}>
                      {lp?.company_name || "No company name"}
                      {lp?.contact_email ? ` · ${lp.contact_email}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                      {roleLabel(c.claimant_role)}
                      {c.units ? ` · ${c.units} units` : ""}
                      {" · Claimed "}
                      {formatDate(c.claimed_at)}
                    </div>
                  </div>

                  {/* Right: badge + actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <StatusBadge status={c.verification_status} />
                    {c.verification_status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleStatusChange(c.id, "approved")}
                          disabled={updating === c.id}
                          style={{
                            ...actionBtn,
                            background: "#1a7f37",
                            color: "#fff",
                            opacity: updating === c.id ? 0.6 : 1,
                          }}
                        >
                          {updating === c.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleStatusChange(c.id, "rejected")}
                          disabled={updating === c.id}
                          style={{
                            ...actionBtn,
                            background: "#cf222e",
                            color: "#fff",
                            opacity: updating === c.id ? 0.6 : 1,
                          }}
                        >
                          {updating === c.id ? "..." : "Reject"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(c.id, "pending")}
                        disabled={updating === c.id}
                        style={{
                          ...actionBtn,
                          background: "#fff",
                          color: "#57606a",
                          border: "1px solid #d0d7de",
                          opacity: updating === c.id ? 0.6 : 1,
                        }}
                      >
                        {updating === c.id ? "..." : "Revert to Pending"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "#fff8c5", fg: "#9a6700" },
    approved: { bg: "#dafbe1", fg: "#1a7f37" },
    rejected: { bg: "#ffebe9", fg: "#cf222e" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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

/* ------------------------------------------------------------------ */
/* Shared styles                                                       */
/* ------------------------------------------------------------------ */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f8fa",
  color: "#1f2328",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

const centerMsg: React.CSSProperties = {
  textAlign: "center",
  padding: "80px 20px",
  color: "#57606a",
  fontSize: 14,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e8ecf0",
  borderRadius: 8,
  padding: "20px 24px",
};

const actionBtn: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 6,
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
