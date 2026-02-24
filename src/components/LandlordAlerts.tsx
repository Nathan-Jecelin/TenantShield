"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface LandlordAlert {
  id: string;
  alert_type: string;
  title: string;
  description: string | null;
  severity: string;
  read: boolean;
  created_at: string;
}

type FilterTab = "all" | "violation" | "311_complaint";

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function LandlordAlerts() {
  const auth = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<LandlordAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [markingAll, setMarkingAll] = useState(false);

  /* ---- Load profile + alerts ---- */
  const loadData = useCallback(async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: prof } = await sb
      .from("landlord_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) {
      window.location.href = "/landlord/signup";
      return;
    }
    setProfileId(prof.id);

    const { data: alts } = await sb
      .from("landlord_alerts")
      .select("id, alert_type, title, description, severity, read, created_at")
      .eq("landlord_id", prof.id)
      .order("read", { ascending: true })
      .order("created_at", { ascending: false });
    if (alts) setAlerts(alts);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      window.location.href = "/landlord/signup";
      return;
    }
    loadData(auth.user.id);
  }, [auth.loading, auth.user, loadData]);

  /* ---- Mark single alert as read ---- */
  async function markAsRead(alertId: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("landlord_alerts").update({ read: true }).eq("id", alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
    );
  }

  /* ---- Mark all as read ---- */
  async function markAllAsRead() {
    if (!profileId) return;
    const sb = getSupabase();
    if (!sb) return;
    setMarkingAll(true);
    await sb
      .from("landlord_alerts")
      .update({ read: true })
      .eq("landlord_id", profileId)
      .eq("read", false);
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setMarkingAll(false);
  }

  /* ---- Filtered alerts ---- */
  const filtered =
    filter === "all"
      ? alerts
      : alerts.filter((a) => a.alert_type === filter);

  const unreadCount = alerts.filter((a) => !a.read).length;

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  if (auth.loading || (auth.user && loading)) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Loading alerts...</div>
        <Footer />
      </div>
    );
  }

  if (!auth.user) {
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
        {/* Back link */}
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

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2328", margin: 0 }}>
            Alerts
            {unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#cf222e",
                  background: "#ffebe9",
                  padding: "2px 10px",
                  borderRadius: 12,
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              style={{
                padding: "8px 18px",
                background: "none",
                border: "1px solid #d0d7de",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "#57606a",
                cursor: "pointer",
                opacity: markingAll ? 0.6 : 1,
              }}
            >
              {markingAll ? "Marking..." : "Mark all as read"}
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(
            [
              { key: "all", label: "All" },
              { key: "violation", label: "Violations" },
              { key: "311_complaint", label: "Complaints" },
            ] as { key: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: filter === tab.key ? "1px solid #1f6feb" : "1px solid #d0d7de",
                background: filter === tab.key ? "#dbeafe" : "#fff",
                color: filter === tab.key ? "#1f6feb" : "#57606a",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              padding: "40px 24px",
            }}
          >
            <p style={{ fontSize: 14, color: "#57606a", margin: 0 }}>
              {alerts.length === 0
                ? "No alerts yet. Alerts will appear when activity is detected on your buildings."
                : "No alerts match this filter."}
            </p>
          </div>
        ) : (
          <div style={cardStyle}>
            {filtered.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "14px 0",
                  borderTop: i > 0 ? "1px solid #e8ecf0" : "none",
                  opacity: a.read ? 0.65 : 1,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                  <AlertIcon type={a.alert_type} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: a.read ? 400 : 600,
                        color: "#1f2328",
                      }}
                    >
                      {a.title}
                    </div>
                    {a.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#57606a",
                          marginTop: 4,
                          lineHeight: 1.4,
                        }}
                      >
                        {a.description}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>
                      {formatDate(a.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <SeverityBadge severity={a.severity} />
                  {!a.read && (
                    <button
                      onClick={() => markAsRead(a.id)}
                      style={{
                        padding: "4px 12px",
                        background: "none",
                        border: "1px solid #d0d7de",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#57606a",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
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

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    high: { bg: "#ffebe9", fg: "#cf222e" },
    medium: { bg: "#fff8c5", fg: "#9a6700" },
    low: { bg: "#dafbe1", fg: "#1a7f37" },
  };
  const s = styles[severity] || styles.medium;
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
      {severity}
    </span>
  );
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
        marginTop: 2,
      }}
    >
      {icons[type] || "?"}
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
