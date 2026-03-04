import { jsPDF } from "jspdf";
import type { BuildingViolation, ServiceRequest } from "./chicagoData";

interface ReviewData {
  author: string;
  rating: number;
  text: string;
  created_at: string;
}

interface ReportData {
  address: string;
  buildingName: string;
  violations: BuildingViolation[];
  complaints: ServiceRequest[];
  reviews: ReviewData[];
}

function formatDate(d: string | undefined): string {
  if (!d) return "N/A";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function generateReport(data: ReportData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = 0;

  function checkPage(needed: number) {
    if (y + needed > pageH - 60) {
      doc.addPage();
      y = margin;
    }
  }

  // ── HEADER BAND ──
  doc.setFillColor(31, 111, 235);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("TenantShield Building Report", margin, 35);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(data.address, margin, 55);
  if (data.buildingName) {
    doc.setFontSize(10);
    doc.text(data.buildingName, margin, 70);
  }
  y = 100;

  // ── SUMMARY STATS ──
  doc.setTextColor(31, 35, 40);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", margin, y);
  y += 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const openViolations = data.violations.filter(
    (v) => v.violation_status?.toUpperCase() === "OPEN"
  ).length;
  const stats = [
    `Total Violations: ${data.violations.length}`,
    `Open Violations: ${openViolations}`,
    `311 Complaints: ${data.complaints.length}`,
    `Tenant Reviews: ${data.reviews.length}`,
    `Report Generated: ${new Date().toLocaleDateString("en-US")}`,
  ];
  for (const s of stats) {
    doc.text(s, margin, y);
    y += 14;
  }
  y += 10;

  // ── VIOLATIONS TABLE ──
  const recentViolations = data.violations.slice(0, 10);
  if (recentViolations.length > 0) {
    checkPage(40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Violations (up to 10)", margin, y);
    y += 18;

    // Table header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 10, contentW, 14, "F");
    doc.setTextColor(80, 80, 80);
    doc.text("Date", margin + 4, y);
    doc.text("Status", margin + 70, y);
    doc.text("Description", margin + 130, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 35, 40);
    for (const v of recentViolations) {
      checkPage(24);
      const desc = truncate(v.violation_description || "", 70);
      doc.setFontSize(7);
      doc.text(formatDate(v.violation_date), margin + 4, y);
      doc.text(truncate(v.violation_status || "", 12), margin + 70, y);
      doc.text(desc, margin + 130, y);
      y += 12;
    }
    y += 10;
  }

  // ── COMPLAINTS TABLE ──
  const recentComplaints = data.complaints.slice(0, 10);
  if (recentComplaints.length > 0) {
    checkPage(40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 35, 40);
    doc.text("Recent 311 Complaints (up to 10)", margin, y);
    y += 18;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 10, contentW, 14, "F");
    doc.setTextColor(80, 80, 80);
    doc.text("Date", margin + 4, y);
    doc.text("Type", margin + 70, y);
    doc.text("Status", margin + 280, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 35, 40);
    for (const c of recentComplaints) {
      checkPage(24);
      doc.setFontSize(7);
      doc.text(formatDate(c.created_date), margin + 4, y);
      doc.text(truncate(c.sr_type || "", 40), margin + 70, y);
      doc.text(truncate(c.status || "", 15), margin + 280, y);
      y += 12;
    }
    y += 10;
  }

  // ── TENANT REVIEWS ──
  if (data.reviews.length > 0) {
    checkPage(40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 35, 40);
    doc.text("Tenant Reviews", margin, y);
    y += 18;

    for (const r of data.reviews.slice(0, 5)) {
      checkPage(50);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      doc.text(`${stars}  —  ${r.author || "Anonymous"}`, margin + 4, y);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(formatDate(r.created_at), margin + 300, y);
      y += 12;

      doc.setTextColor(31, 35, 40);
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(r.text || "", contentW - 10);
      for (const line of lines.slice(0, 4)) {
        checkPage(12);
        doc.text(line, margin + 4, y);
        y += 10;
      }
      y += 8;
    }
  }

  // ── FOOTER ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `TenantShield — mytenantshield.com — Page ${i} of ${totalPages}`,
      margin,
      pageH - 20
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}
