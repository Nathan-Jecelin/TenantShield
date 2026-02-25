"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import {
  parseStreetAddress,
  generateAddressVariants,
  fetchBuildingViolations,
  fetchServiceRequests,
  fetchBuildingPermits,
  fetchFullNeighborhoodData,
} from "@/lib/chicagoData";
import type {
  BuildingViolation,
  ServiceRequest,
  BuildingPermit,
  NeighborhoodResult,
} from "@/lib/chicagoData";
import { addressToSlug } from "@/lib/slugs";
import { canAccess } from "@/lib/plans";

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
  building_id: string;
  alert_type: string;
  title: string;
  description: string | null;
  severity: string;
  read: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* 311 complaint classification (duplicated from TenantShield.tsx)     */
/* ------------------------------------------------------------------ */

const STREET_LEVEL_TYPES = new Set([
  "Pothole in Street",
  "Street Light Out Complaint",
  "Street Lights - All/Out",
  "Street Light 1/Out",
  "Graffiti Removal Request",
  "Graffiti Removal",
  "Abandoned Vehicle Complaint",
  "Street Cleaning Request",
  "Traffic Signal Out Complaint",
  "Weed Removal Request",
  "Tree Trim Request",
  "Tree Removal Request",
  "Tree Debris Clean-Up Request",
  "Alley Light Out Complaint",
  "Alley Grading Request",
  "Alley Pothole Complaint",
  "Pavement Cave-In Inspection Request",
  "Sidewalk Inspection Request",
  "Sign Repair Request - Loss/Damage",
  "Traffic Control Signal Timing Complaint",
  "Viaduct Light Out Complaint",
  "Water On Street Complaint",
  "Street Cut Complaints",
  "Sewer Cave-In Inspection Request",
  "Sewer Cleaning Inspection Request",
  "DuPage Water Commission",
  "Park Maintenance Request",
]);

function isBuildingRelated(srType: string): boolean {
  if (!srType) return false;
  const normalized = srType.trim();
  if (STREET_LEVEL_TYPES.has(normalized)) return false;
  const streetKeywords = [
    "pothole", "street light", "graffiti", "abandoned vehicle",
    "street clean", "traffic signal", "weed removal", "tree trim",
    "tree removal", "tree debris", "alley light", "alley grading",
    "alley pothole", "pavement cave", "sidewalk", "sign repair",
    "viaduct", "sewer", "park maintenance",
  ];
  const lower = normalized.toLowerCase();
  return !streetKeywords.some((kw) => lower.includes(kw));
}

/* ------------------------------------------------------------------ */
/* Building Score                                                     */
/* ------------------------------------------------------------------ */

function computeBuildingScore(
  violations: BuildingViolation[],
  complaints: ServiceRequest[]
): number {
  let score = 100;
  for (const v of violations) {
    const s = v.violation_status?.toUpperCase() || "";
    if (s !== "COMPLIANT" && s !== "COMPLIED") score -= 5;
  }
  for (const c of complaints) {
    const s = c.status?.toUpperCase() || "";
    if (s !== "CLOSED" && s !== "COMPLETED") score -= 3;
  }
  return Math.max(0, score);
}

function scoreColor(score: number): string {
  if (score >= 80) return "#1a7f37";
  if (score >= 50) return "#9a6700";
  return "#cf222e";
}

function scoreBg(score: number): string {
  if (score >= 80) return "#dafbe1";
  if (score >= 50) return "#fff8c5";
  return "#ffebe9";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Good standing — few or no open issues.";
  if (score >= 50) return "Needs attention — several open issues detected.";
  return "Critical — many open violations or complaints.";
}

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function LandlordBuildingDetail() {
  const auth = useAuth();
  const params = useParams();
  const buildingId = params?.id as string | undefined;

  const [profile, setProfile] = useState<LandlordProfile | null | undefined>(undefined);
  const [building, setBuilding] = useState<ClaimedBuilding | null | undefined>(undefined);
  const [alerts, setAlerts] = useState<LandlordAlert[]>([]);

  // Chicago data
  const [violations, setViolations] = useState<BuildingViolation[]>([]);
  const [complaints, setComplaints] = useState<ServiceRequest[]>([]);
  const [permits, setPermits] = useState<BuildingPermit[]>([]);
  const [neighborhoodData, setNeighborhoodData] = useState<NeighborhoodResult | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // UI state
  const [complaintFilter, setComplaintFilter] = useState<"all" | "building" | "street">("all");
  const [violationFilter, setViolationFilter] = useState<"all" | "open" | "resolved">("all");
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [showAllViolations, setShowAllViolations] = useState(false);
  const [showAllComplaints, setShowAllComplaints] = useState(false);

  // Responses state
  const [responses, setResponses] = useState<Record<string, { id: string; response_text: string; created_at: string }>>({});
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseSaving, setResponseSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  /* ---- Upgrade to Pro ---- */
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

  /* ---- Load profile + building + alerts ---- */
  const loadData = useCallback(
    async (userId: string) => {
      if (!buildingId) return;
      const sb = getSupabase();
      if (!sb) return;

      // Load profile
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

      // Load building (security: must belong to this landlord)
      const { data: bldg } = await sb
        .from("claimed_buildings")
        .select("id, address, verification_status, claimant_role, units, claimed_at")
        .eq("id", buildingId)
        .eq("landlord_id", prof.id)
        .maybeSingle();
      if (!bldg) {
        window.location.href = "/landlord/dashboard";
        return;
      }
      setBuilding(bldg);

      // Load alerts for this building
      const { data: alts } = await sb
        .from("landlord_alerts")
        .select("id, building_id, alert_type, title, description, severity, read, created_at")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (alts) setAlerts(alts);

      // Load existing responses for this building
      const { data: resps } = await sb
        .from("landlord_responses")
        .select("id, violation_id, response_text, created_at")
        .eq("building_id", buildingId);
      if (resps) {
        const map: Record<string, { id: string; response_text: string; created_at: string }> = {};
        for (const r of resps) {
          if (r.violation_id) {
            map[r.violation_id] = { id: r.id, response_text: r.response_text, created_at: r.created_at };
          }
        }
        setResponses(map);
      }

      // Fetch Chicago API data
      setDataLoading(true);
      try {
        const parsed = parseStreetAddress(bldg.address);
        const variants = parsed ? generateAddressVariants(parsed) : [bldg.address];
        const [v, c, p] = await Promise.all([
          fetchBuildingViolations(variants),
          fetchServiceRequests(variants),
          fetchBuildingPermits(variants),
        ]);
        setViolations(v);
        setComplaints(c);
        setPermits(p);

        // Fetch community area for neighborhood benchmarks
        try {
          const caWhere = variants
            .map((a) => `starts_with(upper(street_address), '${a.replace(/'/g, "''")}')`)
            .join(" OR ");
          const caParams = new URLSearchParams({
            $select: "community_area",
            $where: caWhere,
            $limit: "1",
          });
          const caRes = await fetch(
            `https://data.cityofchicago.org/resource/v6vf-nfxy.json?${caParams}`
          );
          if (caRes.ok) {
            const caRows: { community_area: string }[] = await caRes.json();
            if (caRows.length > 0 && caRows[0].community_area) {
              const caId = caRows[0].community_area;
              const nhData = await fetchFullNeighborhoodData(caId, `Community Area ${caId}`);
              setNeighborhoodData(nhData);
            }
          }
        } catch {
          // Neighborhood data is optional
        }
      } catch {
        // API errors — leave empty
      }
      setDataLoading(false);
    },
    [buildingId]
  );

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      window.location.href = "/landlord/signup";
      return;
    }
    loadData(auth.user.id);
  }, [auth.loading, auth.user, loadData]);

  /* ---- Save / edit a response ---- */
  const saveResponse = useCallback(
    async (violationId: string) => {
      if (!profile || !buildingId || !responseText.trim()) return;
      setResponseSaving(true);
      const sb = getSupabase();
      if (!sb) return;

      const existing = responses[violationId];
      if (existing) {
        // UPDATE existing response
        const { error } = await sb
          .from("landlord_responses")
          .update({ response_text: responseText.trim(), updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (!error) {
          setResponses((prev) => ({
            ...prev,
            [violationId]: { ...existing, response_text: responseText.trim(), created_at: existing.created_at },
          }));
        }
      } else {
        // INSERT new response
        const { data, error } = await sb
          .from("landlord_responses")
          .insert({
            landlord_id: profile.id,
            building_id: buildingId,
            violation_id: violationId,
            response_text: responseText.trim(),
          })
          .select("id, created_at")
          .single();
        if (!error && data) {
          setResponses((prev) => ({
            ...prev,
            [violationId]: { id: data.id, response_text: responseText.trim(), created_at: data.created_at },
          }));
        }
      }
      setRespondingTo(null);
      setResponseText("");
      setResponseSaving(false);
    },
    [profile, buildingId, responseText, responses]
  );

  /* ---- Derived data ---- */
  const buildingComplaints = complaints.filter((c) => isBuildingRelated(c.sr_type));
  const streetComplaints = complaints.filter((c) => !isBuildingRelated(c.sr_type));
  const filteredComplaints =
    complaintFilter === "building"
      ? buildingComplaints
      : complaintFilter === "street"
        ? streetComplaints
        : complaints;

  // Violation status filtering
  const openViolations = violations.filter((v) => {
    const s = v.violation_status?.toUpperCase() || "";
    return s !== "COMPLIANT" && s !== "COMPLIED";
  });
  const resolvedViolations = violations.filter((v) => {
    const s = v.violation_status?.toUpperCase() || "";
    return s === "COMPLIANT" || s === "COMPLIED";
  });
  const filteredViolations =
    violationFilter === "open"
      ? openViolations
      : violationFilter === "resolved"
        ? resolvedViolations
        : violations;

  // Complaint status filtering (layered on top of type filter)
  const openFilteredComplaints = filteredComplaints.filter((c) => {
    const s = c.status?.toUpperCase() || "";
    return s !== "CLOSED" && s !== "COMPLETED";
  });
  const resolvedFilteredComplaints = filteredComplaints.filter((c) => {
    const s = c.status?.toUpperCase() || "";
    return s === "CLOSED" || s === "COMPLETED";
  });
  const statusFilteredComplaints =
    complaintStatusFilter === "open"
      ? openFilteredComplaints
      : complaintStatusFilter === "resolved"
        ? resolvedFilteredComplaints
        : filteredComplaints;

  const score = computeBuildingScore(violations, complaints);

  // Find this building's rank in neighborhood — use allAddresses for full ranking
  let neighborhoodRank: number | null = null;
  let neighborhoodTotal = 0;
  let neighborhoodTier: "top" | "middle" | "bottom" | null = null;
  if (neighborhoodData && building) {
    const parsed = parseStreetAddress(building.address);
    const variants = parsed ? generateAddressVariants(parsed) : [building.address];
    const all = neighborhoodData.allAddresses;
    neighborhoodTotal = all.length;
    const idx = all.findIndex(
      (a) => variants.some((v) => a.address === v) || a.address === building.address
    );
    if (idx >= 0) {
      neighborhoodRank = idx + 1;
    } else {
      // Building has no complaints — it ranks after all addresses (best position)
      neighborhoodTotal = all.length + 1;
      neighborhoodRank = neighborhoodTotal;
    }
    const pct = neighborhoodRank / neighborhoodTotal;
    if (pct <= 0.25) neighborhoodTier = "bottom"; // most issues = bottom 25%
    else if (pct <= 0.75) neighborhoodTier = "middle";
    else neighborhoodTier = "top"; // least issues = top 25%
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  // Loading
  if (auth.loading || (auth.user && (profile === undefined || building === undefined))) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Loading building details...</div>
        <Footer />
      </div>
    );
  }

  // No auth / no building (should redirect, but safety fallback)
  if (!auth.user || !profile || !building) {
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
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 20,
          }}
        >
          &larr; Back to Dashboard
        </a>

        {/* Header card */}
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
                {building.address}
              </h1>
              <div style={{ fontSize: 13, color: "#57606a", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span>{roleLabel(building.claimant_role)}</span>
                {building.units && <span>· {building.units} units</span>}
                <span>· Claimed {formatDate(building.claimed_at)}</span>
              </div>
              <a
                href={`/address/${addressToSlug(building.address)}`}
                style={{
                  fontSize: 12,
                  color: "#1f6feb",
                  textDecoration: "none",
                  marginTop: 6,
                  display: "inline-block",
                }}
              >
                View public page &rarr;
              </a>
            </div>
            <StatusBadge status={building.verification_status} />
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            margin: "20px 0",
          }}
        >
          <StatCard label="Violations" value={violations.length} />
          <StatCard label="311 Complaints" value={complaints.length} />
          <StatCard label="Permits" value={permits.length} />
          <StatCard label="Alerts" value={alerts.length} />
        </div>

        {/* Building Score */}
        <div
          style={{
            ...cardStyle,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: scoreBg(score),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: scoreColor(score),
              }}
            >
              {dataLoading ? "—" : score}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: "0 0 4px" }}>
              Building Score
            </h2>
            <p style={{ fontSize: 13, color: "#57606a", margin: 0 }}>
              {dataLoading ? "Calculating..." : scoreLabel(score)}
            </p>
            <p style={{ fontSize: 11, color: "#8b949e", margin: "4px 0 0" }}>
              Score = 100 − (5 × open violations) − (3 × open complaints). Floor at 0.
            </p>
          </div>
        </div>

        {/* Building Violations */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <h3 style={{ ...sectionHeadingStyle, marginBottom: 0 }}>
              Building Violations ({filteredViolations.length})
            </h3>
            {violations.length > 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { setViolationFilter("all"); setShowAllViolations(false); }}
                  style={filterBtnStyle(violationFilter === "all")}
                >
                  All ({violations.length})
                </button>
                <button
                  onClick={() => { setViolationFilter("open"); setShowAllViolations(false); }}
                  style={filterBtnStyle(violationFilter === "open")}
                >
                  Open ({openViolations.length})
                </button>
                <button
                  onClick={() => { setViolationFilter("resolved"); setShowAllViolations(false); }}
                  style={filterBtnStyle(violationFilter === "resolved")}
                >
                  Resolved ({resolvedViolations.length})
                </button>
              </div>
            )}
          </div>
          {dataLoading ? (
            <p style={{ fontSize: 14, color: "#57606a" }}>Loading violations...</p>
          ) : filteredViolations.length === 0 ? (
            <p style={{ fontSize: 14, color: "#57606a" }}>
              {violations.length === 0
                ? "No building violations on record for this address."
                : `No ${violationFilter} violations found.`}
            </p>
          ) : (
            <>
              {(showAllViolations ? filteredViolations : filteredViolations.slice(0, 10)).map((v, i, arr) => {
                const isOpen =
                  v.violation_status?.toUpperCase() !== "COMPLIANT" &&
                  v.violation_status?.toUpperCase() !== "COMPLIED";
                return (
                  <div
                    key={v.id || i}
                    style={{
                      borderBottom: i < arr.length - 1 ? "1px solid #f0f3f6" : "none",
                      padding: "16px 0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: isOpen ? "#cf222e" : "#1a7f37",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>
                          {v.inspection_category || "Building Violation"}
                        </span>
                        {v.department_bureau && (
                          <span style={{ fontSize: 11, color: "#8b949e" }}>· {v.department_bureau}</span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isOpen ? "#ffebe9" : "#dafbe1",
                          color: isOpen ? "#cf222e" : "#1a7f37",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {isOpen ? "Open" : "Resolved"}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#424a53", lineHeight: 1.6, margin: "0 0 4px", paddingLeft: 16 }}>
                      {v.violation_description || "No description available"}
                    </p>
                    {v.violation_inspector_comments && v.violation_inspector_comments !== v.violation_description && (
                      <p style={{ fontSize: 12, color: "#57606a", lineHeight: 1.5, margin: "0 0 4px", paddingLeft: 16, fontStyle: "italic" }}>
                        Inspector notes: {v.violation_inspector_comments}
                      </p>
                    )}
                    {v.violation_ordinance && (
                      <p style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.5, margin: "0 0 4px", paddingLeft: 16 }}>
                        {v.violation_ordinance}
                      </p>
                    )}
                    <div style={{ fontSize: 12, color: "#8b949e", paddingLeft: 16, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <span>{v.violation_date ? formatDate(v.violation_date) : "Date unknown"}</span>
                      {!isOpen && v.violation_status_date && <span> · Resolved {formatDate(v.violation_status_date)}</span>}
                      {v.violation_code && <span> · Code {v.violation_code}</span>}
                    </div>

                    {/* Landlord response */}
                    {v.id && responses[v.id] && respondingTo !== v.id && (
                      <div style={{
                        marginTop: 10,
                        marginLeft: 16,
                        padding: "10px 14px",
                        borderLeft: "3px solid #1a7f37",
                        background: "#f0fdf4",
                        borderRadius: "0 6px 6px 0",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1a7f37", marginBottom: 4 }}>Your Response</div>
                        <p style={{ fontSize: 13, color: "#1f2328", margin: "0 0 4px", lineHeight: 1.5 }}>{responses[v.id].response_text}</p>
                        <div style={{ fontSize: 11, color: "#8b949e" }}>{formatDate(responses[v.id].created_at)}</div>
                        <button
                          onClick={() => { setRespondingTo(v.id); setResponseText(responses[v.id].response_text); }}
                          style={{ marginTop: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "none", border: "1px solid #d0d7de", borderRadius: 4, color: "#57606a", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Edit Response
                        </button>
                      </div>
                    )}

                    {/* Respond / edit inline form */}
                    {v.id && respondingTo === v.id && (
                      <div style={{ marginTop: 10, marginLeft: 16, padding: "12px 14px", background: "#f6f8fa", borderRadius: 6, border: "1px solid #e8ecf0" }}>
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Write a public response to this violation..."
                          rows={3}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            fontSize: 13,
                            border: "1px solid #d0d7de",
                            borderRadius: 6,
                            fontFamily: "inherit",
                            resize: "vertical",
                            boxSizing: "border-box",
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button
                            onClick={() => saveResponse(v.id)}
                            disabled={responseSaving || !responseText.trim()}
                            style={{
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: responseSaving || !responseText.trim() ? "#94d3a2" : "#1a7f37",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              cursor: responseSaving || !responseText.trim() ? "not-allowed" : "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {responseSaving ? "Saving..." : responses[v.id] ? "Update" : "Save Response"}
                          </button>
                          <button
                            onClick={() => { setRespondingTo(null); setResponseText(""); }}
                            style={{
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: "none",
                              border: "1px solid #d0d7de",
                              borderRadius: 6,
                              color: "#57606a",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Respond button (when no response and not currently editing) */}
                    {v.id && !responses[v.id] && respondingTo !== v.id && (
                      canAccess("respond", profile.plan) ? (
                        <button
                          onClick={() => { setRespondingTo(v.id); setResponseText(""); }}
                          style={{
                            marginTop: 8,
                            marginLeft: 16,
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#f6f8fa",
                            border: "1px solid #d0d7de",
                            borderRadius: 4,
                            color: "#1f6feb",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Respond
                        </button>
                      ) : (
                        <button
                          onClick={handleUpgrade}
                          disabled={upgrading}
                          style={{
                            marginTop: 8,
                            marginLeft: 16,
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "linear-gradient(135deg, #1f6feb, #1a7f37)",
                            border: "none",
                            borderRadius: 4,
                            color: "#fff",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            opacity: upgrading ? 0.7 : 1,
                          }}
                        >
                          Upgrade to Respond
                        </button>
                      )
                    )}
                  </div>
                );
              })}
              {filteredViolations.length > 10 && (
                <button
                  onClick={() => setShowAllViolations((p) => !p)}
                  style={showMoreBtnStyle}
                >
                  {showAllViolations ? "Show less" : `Show all ${filteredViolations.length}`}
                </button>
              )}
            </>
          )}
        </div>

        {/* 311 Complaints with filter tabs */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <h3 style={{ ...sectionHeadingStyle, marginBottom: 0 }}>
              311 Complaints ({statusFilteredComplaints.length})
            </h3>
            {complaints.length > 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { setComplaintFilter("all"); setComplaintStatusFilter("all"); setShowAllComplaints(false); }}
                  style={filterBtnStyle(complaintFilter === "all")}
                >
                  All ({complaints.length})
                </button>
                <button
                  onClick={() => { setComplaintFilter("building"); setComplaintStatusFilter("all"); setShowAllComplaints(false); }}
                  style={filterBtnStyle(complaintFilter === "building")}
                >
                  Building ({buildingComplaints.length})
                </button>
                <button
                  onClick={() => { setComplaintFilter("street"); setComplaintStatusFilter("all"); setShowAllComplaints(false); }}
                  style={filterBtnStyle(complaintFilter === "street")}
                >
                  Street ({streetComplaints.length})
                </button>
              </div>
            )}
          </div>
          {complaints.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <button
                onClick={() => { setComplaintStatusFilter("all"); setShowAllComplaints(false); }}
                style={filterBtnStyle(complaintStatusFilter === "all")}
              >
                All ({filteredComplaints.length})
              </button>
              <button
                onClick={() => { setComplaintStatusFilter("open"); setShowAllComplaints(false); }}
                style={filterBtnStyle(complaintStatusFilter === "open")}
              >
                Open ({openFilteredComplaints.length})
              </button>
              <button
                onClick={() => { setComplaintStatusFilter("resolved"); setShowAllComplaints(false); }}
                style={filterBtnStyle(complaintStatusFilter === "resolved")}
              >
                Resolved ({resolvedFilteredComplaints.length})
              </button>
            </div>
          )}
          {complaintFilter !== "all" && (
            <div style={{ fontSize: 12, color: "#57606a", marginBottom: 12, padding: "8px 12px", background: "#f6f8fa", borderRadius: 6 }}>
              {complaintFilter === "building"
                ? "Showing building-related complaints (noise, no heat, water issues, building code, etc.)"
                : "Showing street-level complaints (potholes, graffiti, street lights, abandoned vehicles, etc.)"}
            </div>
          )}
          {dataLoading ? (
            <p style={{ fontSize: 14, color: "#57606a" }}>Loading complaints...</p>
          ) : statusFilteredComplaints.length === 0 ? (
            <p style={{ fontSize: 14, color: "#57606a" }}>
              {complaints.length === 0
                ? "No 311 complaints on record for this address."
                : `No matching complaints found.`}
            </p>
          ) : (
            <>
              {(showAllComplaints ? statusFilteredComplaints : statusFilteredComplaints.slice(0, 10)).map((c, i, arr) => {
                const isClosed = c.status?.toUpperCase() === "CLOSED" || c.status?.toUpperCase() === "COMPLETED";
                const isBldg = isBuildingRelated(c.sr_type);
                return (
                  <div
                    key={c.sr_number || i}
                    style={{
                      borderBottom: i < arr.length - 1 ? "1px solid #f0f3f6" : "none",
                      padding: "16px 0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: isClosed ? "#1a7f37" : "#bc4c00",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>
                          {c.sr_type || "Service Request"}
                        </span>
                        {complaintFilter === "all" && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "1px 6px",
                              borderRadius: 3,
                              background: isBldg ? "#ddf4ff" : "#fff8c5",
                              color: isBldg ? "#0969da" : "#9a6700",
                            }}
                          >
                            {isBldg ? "Building" : "Street"}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isClosed ? "#dafbe1" : "#fff1e5",
                          color: isClosed ? "#1a7f37" : "#bc4c00",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {isClosed ? "Resolved" : "Open"}
                      </span>
                    </div>
                    {c.owner_department && (
                      <div style={{ fontSize: 12, color: "#424a53", paddingLeft: 16, marginBottom: 4 }}>
                        Handled by: {c.owner_department}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#8b949e", paddingLeft: 16, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <span>Filed {c.created_date ? formatDate(c.created_date) : "date unknown"}</span>
                      {isClosed && c.closed_date && <span> · Closed {formatDate(c.closed_date)}</span>}
                      {c.sr_number && <span> · #{c.sr_number}</span>}
                      {c.ward && <span> · Ward {c.ward}</span>}
                    </div>

                    {/* Landlord response for complaint */}
                    {(() => {
                      const cKey = c.sr_number ? `sr_${c.sr_number}` : null;
                      if (!cKey) return null;
                      if (responses[cKey] && respondingTo !== cKey) {
                        return (
                          <div style={{
                            marginTop: 10,
                            marginLeft: 16,
                            padding: "10px 14px",
                            borderLeft: "3px solid #1a7f37",
                            background: "#f0fdf4",
                            borderRadius: "0 6px 6px 0",
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a7f37", marginBottom: 4 }}>Your Response</div>
                            <p style={{ fontSize: 13, color: "#1f2328", margin: "0 0 4px", lineHeight: 1.5 }}>{responses[cKey].response_text}</p>
                            <div style={{ fontSize: 11, color: "#8b949e" }}>{formatDate(responses[cKey].created_at)}</div>
                            <button
                              onClick={() => { setRespondingTo(cKey); setResponseText(responses[cKey].response_text); }}
                              style={{ marginTop: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "none", border: "1px solid #d0d7de", borderRadius: 4, color: "#57606a", cursor: "pointer", fontFamily: "inherit" }}
                            >
                              Edit Response
                            </button>
                          </div>
                        );
                      }
                      if (respondingTo === cKey) {
                        return (
                          <div style={{ marginTop: 10, marginLeft: 16, padding: "12px 14px", background: "#f6f8fa", borderRadius: 6, border: "1px solid #e8ecf0" }}>
                            <textarea
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Write a public response to this complaint..."
                              rows={3}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                fontSize: 13,
                                border: "1px solid #d0d7de",
                                borderRadius: 6,
                                fontFamily: "inherit",
                                resize: "vertical",
                                boxSizing: "border-box",
                              }}
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button
                                onClick={() => saveResponse(cKey)}
                                disabled={responseSaving || !responseText.trim()}
                                style={{
                                  padding: "6px 14px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: responseSaving || !responseText.trim() ? "#94d3a2" : "#1a7f37",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: responseSaving || !responseText.trim() ? "not-allowed" : "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                {responseSaving ? "Saving..." : responses[cKey] ? "Update" : "Save Response"}
                              </button>
                              <button
                                onClick={() => { setRespondingTo(null); setResponseText(""); }}
                                style={{
                                  padding: "6px 14px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: "none",
                                  border: "1px solid #d0d7de",
                                  borderRadius: 6,
                                  color: "#57606a",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return canAccess("respond", profile.plan) ? (
                        <button
                          onClick={() => { setRespondingTo(cKey); setResponseText(""); }}
                          style={{
                            marginTop: 8,
                            marginLeft: 16,
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#f6f8fa",
                            border: "1px solid #d0d7de",
                            borderRadius: 4,
                            color: "#1f6feb",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Respond
                        </button>
                      ) : (
                        <button
                          onClick={handleUpgrade}
                          disabled={upgrading}
                          style={{
                            marginTop: 8,
                            marginLeft: 16,
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "linear-gradient(135deg, #1f6feb, #1a7f37)",
                            border: "none",
                            borderRadius: 4,
                            color: "#fff",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            opacity: upgrading ? 0.7 : 1,
                          }}
                        >
                          Upgrade to Respond
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
              {statusFilteredComplaints.length > 10 && (
                <button
                  onClick={() => setShowAllComplaints((p) => !p)}
                  style={showMoreBtnStyle}
                >
                  {showAllComplaints ? "Show less" : `Show all ${statusFilteredComplaints.length}`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Recent Alerts */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={sectionHeadingStyle}>Recent Alerts</h3>
          {!canAccess("alerts", profile.plan) ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 14, color: "#57606a", margin: "0 0 12px" }}>
                Alerts are a Pro feature. Upgrade to get notified when new violations or complaints are filed.
              </p>
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
            </div>
          ) : alerts.length === 0 ? (
            <p style={{ fontSize: 14, color: "#57606a" }}>
              No alerts for this building yet.
            </p>
          ) : (
            alerts.map((a, i) => (
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
                    {a.description && (
                      <div style={{ fontSize: 12, color: "#57606a", marginTop: 2 }}>
                        {a.description}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                      {formatDate(a.created_at)}
                    </div>
                  </div>
                </div>
                <SeverityBadge severity={a.severity} />
              </div>
            ))
          )}
        </div>

        {/* Neighborhood Benchmarks */}
        {neighborhoodData && !canAccess("benchmarks", profile.plan) && (
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h3 style={sectionHeadingStyle}>Neighborhood Benchmarks</h3>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 14, color: "#57606a", margin: "0 0 12px" }}>
                See how your building compares to others in the neighborhood. Upgrade to Pro to unlock benchmarks.
              </p>
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
            </div>
          </div>
        )}
        {neighborhoodData && canAccess("benchmarks", profile.plan) && (
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h3 style={sectionHeadingStyle}>
              Neighborhood Benchmarks — {neighborhoodData.neighborhoodName}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div style={nhStatStyle}>
                <div style={nhStatValueStyle}>{neighborhoodData.totalComplaints}</div>
                <div style={nhStatLabelStyle}>Total 311 Complaints</div>
              </div>
              <div style={nhStatStyle}>
                <div style={nhStatValueStyle}>{neighborhoodData.totalViolations}</div>
                <div style={nhStatLabelStyle}>Total Violations</div>
              </div>
              <div style={nhStatStyle}>
                <div style={nhStatValueStyle}>
                  {neighborhoodRank ? `#${neighborhoodRank}` : "—"}
                </div>
                <div style={nhStatLabelStyle}>
                  {neighborhoodRank
                    ? `of ${neighborhoodTotal} buildings`
                    : "Not ranked"}
                </div>
                {neighborhoodTier && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 10,
                    display: "inline-block",
                    background: neighborhoodTier === "top" ? "#dafbe1" : neighborhoodTier === "middle" ? "#f6f8fa" : "#ffebe9",
                    color: neighborhoodTier === "top" ? "#1a7f37" : neighborhoodTier === "middle" ? "#57606a" : "#cf222e",
                  }}>
                    {neighborhoodTier === "top"
                      ? "Top 25% in your area"
                      : neighborhoodTier === "middle"
                        ? "Average for your area"
                        : "Needs attention — bottom 25%"}
                  </div>
                )}
              </div>
            </div>
            {neighborhoodData.topAddresses.length > 0 && (
              <>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "#57606a", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Top Addresses by Activity
                </h4>
                {neighborhoodData.topAddresses.slice(0, 5).map((a, i) => (
                  <div
                    key={a.address}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderTop: i > 0 ? "1px solid #f0f3f6" : "none",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: building.address === a.address || parseStreetAddress(building.address) === a.address ? "#1f6feb" : "#1f2328", fontWeight: building.address === a.address || parseStreetAddress(building.address) === a.address ? 600 : 400 }}>
                      #{i + 1} {a.address}
                    </span>
                    <span style={{ color: "#57606a", fontSize: 12 }}>
                      {a.complaintCount} complaints · {a.violationCount} violations
                    </span>
                  </div>
                ))}
              </>
            )}
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

function filterBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px",
    background: active ? "#1f6feb" : "#f6f8fa",
    border: active ? "1px solid #1f6feb" : "1px solid #e8ecf0",
    borderRadius: 20,
    color: active ? "#fff" : "#57606a",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
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

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#1f2328",
  margin: "0 0 16px",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const showMoreBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "10px 0",
  background: "#f6f8fa",
  border: "1px solid #e8ecf0",
  borderRadius: 6,
  color: "#1f6feb",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  marginTop: 8,
};

const nhStatStyle: React.CSSProperties = {
  background: "#f6f8fa",
  borderRadius: 8,
  padding: "16px 12px",
  textAlign: "center",
};

const nhStatValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#1f2328",
  lineHeight: 1,
};

const nhStatLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#57606a",
  marginTop: 6,
};
