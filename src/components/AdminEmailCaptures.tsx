"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";

const ADMIN_EMAILS = new Set(["njecelin17@gmail.com", "nathan@mytenantshield.com"]);

interface EmailCapture {
  id: string;
  email: string;
  address: string;
  building_name: string;
  report_sent: boolean;
  email_opened: boolean;
  followup_sent: boolean;
  followup_sent_at: string | null;
  created_at: string;
}

export default function AdminEmailCaptures() {
  const auth = useAuth();
  const [captures, setCaptures] = useState<EmailCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingFollowup, setSendingFollowup] = useState<string | null>(null);

  const isAdmin =
    !auth.loading && !!(auth.user?.email && ADMIN_EMAILS.has(auth.user.email));

  const loadCaptures = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    const { data } = await sb
      .from("email_captures")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCaptures(data as EmailCapture[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadCaptures();
  }, [isAdmin, loadCaptures]);

  const handleSendFollowup = async (captureId: string) => {
    setSendingFollowup(captureId);
    try {
      const res = await fetch("/api/reports/followup-single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ""}`,
        },
        body: JSON.stringify({ captureId }),
      });
      if (!res.ok) throw new Error("Failed");
      await loadCaptures();
    } catch {
      alert("Failed to send follow-up.");
    }
    setSendingFollowup(null);
  };

  const exportCSV = () => {
    const header = "email,address,building_name,created_at,report_sent,email_opened,followup_sent\n";
    const rows = captures.map((c) =>
      [
        c.email,
        `"${c.address}"`,
        `"${c.building_name}"`,
        c.created_at,
        c.report_sent,
        c.email_opened,
        c.followup_sent,
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-captures-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (auth.loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <h1 style={{ fontSize: 20, color: "#d1242f" }}>Access Denied</h1>
        <p style={{ color: "#57606a" }}>You must be an admin to view this page.</p>
      </div>
    );
  }

  const totalCaptures = captures.length;
  const totalOpened = captures.filter((c) => c.email_opened).length;
  const openRate = totalCaptures > 0 ? ((totalOpened / totalCaptures) * 100).toFixed(1) : "0";
  const totalFollowups = captures.filter((c) => c.followup_sent).length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2328", margin: 0 }}>Email Captures</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/admin"
            style={{
              padding: "6px 14px",
              background: "#f6f8fa",
              border: "1px solid #d0d7de",
              borderRadius: 6,
              color: "#1f2328",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← Admin
          </a>
          <button
            onClick={exportCSV}
            style={{
              padding: "6px 14px",
              background: "#1f6feb",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Captures", value: totalCaptures },
          { label: "Open Rate", value: `${openRate}%` },
          { label: "Follow-ups Sent", value: totalFollowups },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              minWidth: 140,
              padding: "12px 16px",
              background: "#f6f8fa",
              border: "1px solid #e8ecf0",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 11, color: "#57606a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1f2328" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#57606a" }}>Loading…</p>
      ) : captures.length === 0 ? (
        <p style={{ textAlign: "center", color: "#57606a" }}>No email captures yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e8ecf0" }}>
                {["Email", "Address", "Building", "Date", "Sent", "Opened", "Follow-up", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#57606a",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {captures.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #e8ecf0" }}>
                  <td style={{ padding: "8px 10px", color: "#1f2328" }}>{c.email}</td>
                  <td style={{ padding: "8px 10px", color: "#1f2328", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.address}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#57606a" }}>{c.building_name || "—"}</td>
                  <td style={{ padding: "8px 10px", color: "#57606a", whiteSpace: "nowrap" }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: c.report_sent ? "#1a7f37" : "#8b949e" }}>
                      {c.report_sent ? "✓" : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: c.email_opened ? "#1a7f37" : "#8b949e" }}>
                      {c.email_opened ? "✓" : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: c.followup_sent ? "#1a7f37" : "#8b949e" }}>
                      {c.followup_sent ? "✓" : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {!c.followup_sent && c.report_sent && (
                      <button
                        onClick={() => handleSendFollowup(c.id)}
                        disabled={sendingFollowup === c.id}
                        style={{
                          padding: "4px 10px",
                          background: sendingFollowup === c.id ? "#8b949e" : "#2da44e",
                          border: "none",
                          borderRadius: 4,
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: sendingFollowup === c.id ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {sendingFollowup === c.id ? "Sending…" : "Send Follow-up"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
