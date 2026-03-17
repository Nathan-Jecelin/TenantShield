import { ImageResponse } from "next/og";
import { NEIGHBORHOOD_DATA } from "@/lib/neighborhoodData";
import {
  NEIGHBORHOOD_SLUG_TO_ID,
  fetchNeighborhoodData,
} from "@/lib/chicagoData";

export const runtime = "nodejs";
export const alt = "TenantShield — Neighborhood Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: { slug: string };
}) {
  const communityAreaId = NEIGHBORHOOD_SLUG_TO_ID[params.slug];
  const info = communityAreaId ? NEIGHBORHOOD_DATA[communityAreaId] : null;
  const name = info?.name ?? params.slug.replace(/-/g, " ");

  let buildingCount = 0;
  let totalComplaints = 0;
  if (communityAreaId) {
    try {
      const { allAddresses } = await fetchNeighborhoodData(communityAreaId);
      buildingCount = allAddresses.length;
      totalComplaints = allAddresses.reduce((sum, a) => sum + a.count, 0);
    } catch {
      // continue with zeros
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a1628 0%, #0f2440 50%, #0a1628 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.04,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            display: "flex",
          }}
        />

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
          <svg width="36" height="36" viewBox="0 0 32 32">
            <path
              d="M16 29.3s10.7-5.3 10.7-13.3V6.7L16 2.7 5.3 6.7V16c0 8 10.7 13.3 10.7 13.3z"
              fill="#1f6feb"
            />
            <path
              d="M12.5 16.5l2.5 2.5 5-5"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
            TenantShield
          </div>
        </div>

        {/* Neighborhood name */}
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1px",
            lineHeight: 1.1,
            marginBottom: 12,
          }}
        >
          {name}
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 48,
          }}
        >
          Chicago Neighborhood Report
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "20px 32px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "#ffffff" }}>
              {buildingCount.toLocaleString()}
            </div>
            <div style={{ display: "flex", fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              Buildings Tracked
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "20px 32px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "#ffffff" }}>
              {totalComplaints.toLocaleString()}
            </div>
            <div style={{ display: "flex", fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              311 Complaints
            </div>
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 80,
            display: "flex",
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            fontWeight: 600,
          }}
        >
          mytenantshield.com
        </div>
      </div>
    ),
    { ...size }
  );
}
