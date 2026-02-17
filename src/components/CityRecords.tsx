import { useState } from "react";
import type { BuildingViolation, ServiceRequest } from "@/lib/chicagoData";

interface CityRecordsProps {
  violations: BuildingViolation[];
  complaints: ServiceRequest[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function formatDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const upper = (status || "").toUpperCase();
  const isOpen = upper.includes("OPEN");
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 4,
        background: isOpen ? "#ffebe9" : "#dafbe1",
        color: isOpen ? "#cf222e" : "#1a7f37",
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {status || "Unknown"}
    </span>
  );
}

function ViolationCard({ v }: { v: BuildingViolation }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid #e8ecf0",
        borderRadius: 6,
        background: "#fff",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 12, color: "#8b949e" }}>
          {formatDate(v.violation_date)}
        </span>
        <StatusBadge status={v.violation_status} />
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#1f2328",
          lineHeight: 1.5,
          marginBottom: 6,
        }}
      >
        {v.violation_description}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 11,
          color: "#8b949e",
          flexWrap: "wrap",
        }}
      >
        {v.inspection_category && <span>{v.inspection_category}</span>}
        <span>{v.address}</span>
      </div>
    </div>
  );
}

function ComplaintCard({ c }: { c: ServiceRequest }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid #e8ecf0",
        borderRadius: 6,
        background: "#fff",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 12, color: "#8b949e" }}>
          {formatDate(c.created_date)}
        </span>
        <StatusBadge status={c.status} />
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#1f2328",
          lineHeight: 1.5,
          marginBottom: 6,
        }}
      >
        {c.sr_type}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 11,
          color: "#8b949e",
          flexWrap: "wrap",
        }}
      >
        <span>{c.sr_number}</span>
        <span>{c.street_address}</span>
      </div>
    </div>
  );
}

const INITIAL_SHOW = 10;

export default function CityRecords({
  violations,
  complaints,
  loading,
  error,
  onRetry,
}: CityRecordsProps) {
  const [showAllViolations, setShowAllViolations] = useState(false);
  const [showAllComplaints, setShowAllComplaints] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          border: "1px solid #e8ecf0",
          borderRadius: 8,
          background: "#fff",
          padding: "20px 28px",
          marginBottom: 16,
        }}
      >
        <div style={{ textAlign: "center", padding: "24px 0", color: "#57606a", fontSize: 14 }}>
          Loading city records...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          border: "1px solid #e8ecf0",
          borderRadius: 8,
          background: "#fff",
          padding: "20px 28px",
          marginBottom: 16,
        }}
      >
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 14, color: "#cf222e", marginBottom: 12 }}>
            {error}
          </div>
          <button
            onClick={onRetry}
            style={{
              padding: "8px 18px",
              background: "#f6f8fa",
              border: "1px solid #d0d7de",
              borderRadius: 6,
              color: "#1f2328",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const visibleViolations = showAllViolations
    ? violations
    : violations.slice(0, INITIAL_SHOW);
  const visibleComplaints = showAllComplaints
    ? complaints
    : complaints.slice(0, INITIAL_SHOW);

  const showMoreBtn = (
    total: number,
    expanded: boolean,
    toggle: () => void
  ) => {
    if (total <= INITIAL_SHOW) return null;
    return (
      <button
        onClick={toggle}
        style={{
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
          marginTop: 4,
        }}
      >
        {expanded ? "Show less" : `Show all ${total}`}
      </button>
    );
  };

  return (
    <div
      style={{
        border: "1px solid #e8ecf0",
        borderRadius: 8,
        background: "#fff",
        padding: "20px 28px",
        marginBottom: 16,
      }}
    >
      {/* Building Violations */}
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#1f2328",
          margin: "0 0 12px",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Building Violations ({violations.length})
      </h3>
      {violations.length === 0 ? (
        <div
          style={{
            padding: "20px 0",
            textAlign: "center",
            fontSize: 13,
            color: "#8b949e",
          }}
        >
          No violations found for these addresses.
        </div>
      ) : (
        <>
          {visibleViolations.map((v, i) => (
            <ViolationCard key={v.id || i} v={v} />
          ))}
          {showMoreBtn(violations.length, showAllViolations, () =>
            setShowAllViolations((p) => !p)
          )}
        </>
      )}

      {/* 311 Service Requests */}
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#1f2328",
          margin: "24px 0 12px",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        311 Service Requests ({complaints.length})
      </h3>
      {complaints.length === 0 ? (
        <div
          style={{
            padding: "20px 0",
            textAlign: "center",
            fontSize: 13,
            color: "#8b949e",
          }}
        >
          No 311 complaints found for these addresses.
        </div>
      ) : (
        <>
          {visibleComplaints.map((c, i) => (
            <ComplaintCard key={c.sr_number || i} c={c} />
          ))}
          {showMoreBtn(complaints.length, showAllComplaints, () =>
            setShowAllComplaints((p) => !p)
          )}
        </>
      )}
    </div>
  );
}
