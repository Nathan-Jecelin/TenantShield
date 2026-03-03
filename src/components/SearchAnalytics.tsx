"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Constants & Types                                                   */
/* ------------------------------------------------------------------ */

const ADMIN_EMAILS = new Set(["njecelin17@gmail.com", "nathan@mytenantshield.com"]);

interface Totals {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
}

interface TopAddress {
  address: string;
  view_count: number;
  unique_sessions?: number;
}

interface DailyVolume {
  date: string;
  count: number;
}

interface BuildingTrend {
  address: string;
  total: number;
  daily: { date: string; count: number }[];
}

interface AnalyticsData {
  totals: Totals;
  topWeek: TopAddress[];
  topMonth: TopAddress[];
  dailyVolume: DailyVolume[];
  buildingTrends: BuildingTrend[];
}

interface BuildingDetail {
  address: string;
  daily: { view_date: string; view_count: number; unique_sessions: number }[];
}

/* ------------------------------------------------------------------ */
/* SVG Chart helpers                                                    */
/* ------------------------------------------------------------------ */

function LineChart({
  data,
  width = 600,
  height = 200,
  color = "#1a7f37",
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return <div style={{ color: "#8b949e", fontSize: 13, padding: 16 }}>No data yet</div>;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const padTop = 20;
  const padBottom = 36;
  const padLeft = 40;
  const padRight = 16;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = data.map((d, i) => ({
    x: padLeft + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: padTop + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `M ${points[0].x},${padTop + chartH} ${points.map((p) => `L ${p.x},${p.y}`).join(" ")} L ${points[points.length - 1].x},${padTop + chartH} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: padTop + chartH - f * chartH,
    label: Math.round(f * maxVal).toString(),
  }));

  // X-axis labels (show ~6 evenly spaced)
  const labelCount = Math.min(6, data.length);
  const xLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = data.length === 1 ? 0 : Math.round((i / (labelCount - 1)) * (data.length - 1));
    xLabels.push({ x: points[idx].x, label: data[idx].label });
  }

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yTicks.map((t) => (
        <line key={t.label} x1={padLeft} y1={t.y} x2={width - padRight} y2={t.y} stroke="#e8ecf0" strokeWidth="1" />
      ))}
      {/* Y-axis labels */}
      {yTicks.map((t) => (
        <text key={`yl-${t.label}`} x={padLeft - 6} y={t.y + 4} textAnchor="end" fontSize="11" fill="#8b949e">
          {t.label}
        </text>
      ))}
      {/* X-axis labels */}
      {xLabels.map((l) => (
        <text key={l.label} x={l.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#8b949e">
          {l.label}
        </text>
      ))}
      {/* Area */}
      <path d={areaPath} fill="url(#areaFill)" />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="2">
          <title>{`${p.label}: ${p.value}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const trending = data[data.length - 1] >= data[0];
  const color = trending ? "#1a7f37" : "#cf222e";
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function SearchAnalytics() {
  const auth = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"week" | "month">("week");
  const [modal, setModal] = useState<BuildingDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  const isAdmin =
    !auth.loading && !!(auth.user?.email && ADMIN_EMAILS.has(auth.user.email));

  const getToken = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return null;
    const { data: sessionData } = await sb.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }, []);

  /* ---- Fetch analytics data ---- */
  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    if (!auth.loading && isAdmin) loadData();
    if (!auth.loading && !isAdmin) setLoading(false);
  }, [auth.loading, isAdmin, loadData]);

  /* ---- Fetch building detail ---- */
  async function openBuildingDetail(address: string) {
    const token = await getToken();
    if (!token) return;
    setModalLoading(true);
    setModal({ address, daily: [] });
    try {
      const res = await fetch(
        `/api/admin/analytics/building?address=${encodeURIComponent(address)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setModal(await res.json());
      }
    } catch {
      // ignore
    }
    setModalLoading(false);
  }

  /* ---- Export CSV ---- */
  async function handleExport() {
    const token = await getToken();
    if (!token) return;
    setExportingCSV(true);
    try {
      const res = await fetch(
        `/api/admin/analytics/export?period=${tab}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `address-views-${tab}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    }
    setExportingCSV(false);
  }

  /* ---- Render ---- */

  if (auth.loading || loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>
        <span style={{ fontSize: 14, color: "#57606a" }}>Loading analytics...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, color: "#24292f", margin: "0 0 8px" }}>Access Denied</h2>
        <p style={{ fontSize: 14, color: "#57606a" }}>Admin access required.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>
        <span style={{ fontSize: 14, color: "#57606a" }}>Failed to load analytics data.</span>
      </div>
    );
  }

  const topList = tab === "week" ? data.topWeek : data.topMonth;

  // Format date for chart labels: "Mar 2"
  const formatDate = (d: string) => {
    const dt = new Date(d + "T00:00:00Z");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#24292f", margin: 0 }}>Search Analytics</h1>
          <p style={{ fontSize: 14, color: "#8b949e", margin: "4px 0 0" }}>Address view tracking and building trends</p>
        </div>
        <a
          href="/"
          style={{
            padding: "6px 12px",
            background: "#f6f8fa",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            color: "#24292f",
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          ← Back to Dashboard
        </a>
      </div>

      {/* Totals row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Today", value: data.totals.today, color: "#1f6feb" },
          { label: "This Week", value: data.totals.thisWeek, color: "#1a7f37" },
          { label: "This Month", value: data.totals.thisMonth, color: "#9a6700" },
          { label: "All Time", value: data.totals.allTime, color: "#6e40c9" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              padding: "20px 24px",
            }}
          >
            <div style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
              {card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* 30-day line chart */}
      <div style={{ border: "1px solid #e8ecf0", borderRadius: 8, background: "#fff", padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#24292f", margin: "0 0 16px" }}>Daily Views (Last 30 Days)</h2>
        <LineChart
          data={data.dailyVolume.map((d) => ({ label: formatDate(d.date), value: d.count }))}
          color="#1f6feb"
        />
      </div>

      {/* Top buildings table */}
      <div style={{ border: "1px solid #e8ecf0", borderRadius: 8, background: "#fff", padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#24292f", margin: 0 }}>Top Buildings</h2>
          <div style={{ display: "flex", gap: 4 }}>
            {(["week", "month"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid #d0d7de",
                  borderRadius: 6,
                  background: tab === t ? "#0969da" : "#f6f8fa",
                  color: tab === t ? "#fff" : "#24292f",
                  cursor: "pointer",
                }}
              >
                {t === "week" ? "7 Days" : "30 Days"}
              </button>
            ))}
            <button
              onClick={handleExport}
              disabled={exportingCSV}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid #d0d7de",
                borderRadius: 6,
                background: "#f6f8fa",
                color: "#24292f",
                cursor: "pointer",
                marginLeft: 8,
                opacity: exportingCSV ? 0.6 : 1,
              }}
            >
              {exportingCSV ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {topList.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "#8b949e", fontSize: 13 }}>
            No address views recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e8ecf0" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#57606a", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#57606a", fontWeight: 600 }}>Address</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "#57606a", fontWeight: 600 }}>Views</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "#57606a", fontWeight: 600 }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {topList.map((row, i) => {
                  const trend = data.buildingTrends.find((b) => b.address === row.address);
                  return (
                    <tr
                      key={row.address}
                      onClick={() => openBuildingDetail(row.address)}
                      style={{
                        borderBottom: "1px solid #f0f3f6",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "10px 12px", color: "#8b949e" }}>{i + 1}</td>
                      <td style={{ padding: "10px 12px", color: "#0969da", fontWeight: 500 }}>{row.address}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: "#24292f" }}>
                        {row.view_count.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {trend ? <Sparkline data={trend.daily.map((d) => d.count)} /> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Building detail modal */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: "90%",
              maxWidth: 640,
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#24292f", margin: 0 }}>{modal.address}</h3>
              <button
                onClick={() => setModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#57606a",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>

            {modalLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "#8b949e" }}>Loading...</div>
            ) : modal.daily.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#8b949e" }}>No daily data available.</div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <LineChart
                    data={modal.daily.map((d) => ({
                      label: formatDate(d.view_date),
                      value: d.view_count,
                    }))}
                    color="#6e40c9"
                  />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e8ecf0" }}>
                        <th style={{ textAlign: "left", padding: "6px 12px", color: "#57606a", fontWeight: 600 }}>Date</th>
                        <th style={{ textAlign: "right", padding: "6px 12px", color: "#57606a", fontWeight: 600 }}>Views</th>
                        <th style={{ textAlign: "right", padding: "6px 12px", color: "#57606a", fontWeight: 600 }}>Unique Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...modal.daily].reverse().map((d) => (
                        <tr key={d.view_date} style={{ borderBottom: "1px solid #f0f3f6" }}>
                          <td style={{ padding: "6px 12px" }}>{formatDate(d.view_date)}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600 }}>{d.view_count}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>{d.unique_sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
