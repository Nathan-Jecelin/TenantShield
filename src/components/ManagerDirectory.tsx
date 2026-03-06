"use client";

import { useState, useMemo } from "react";

interface ManagerEntry {
  slug: string;
  company_name: string;
  logo_url: string | null;
  totalBuildings: number;
  avgRating: number;
  totalReviews: number;
  responseRate: number;
}

type SortKey = "rating" | "buildings" | "response" | "reviews";

function getRatingColor(r: number) {
  if (r >= 4) return { bg: "#dafbe1", color: "#1a7f37" };
  if (r >= 3) return { bg: "#fff8c5", color: "#9a6700" };
  return { bg: "#ffebe9", color: "#cf222e" };
}

export default function ManagerDirectory({ managers }: { managers: ManagerEntry[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");

  const filtered = useMemo(() => {
    let list = managers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.company_name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case "rating": return b.avgRating - a.avgRating;
        case "buildings": return b.totalBuildings - a.totalBuildings;
        case "response": return b.responseRate - a.responseRate;
        case "reviews": return b.totalReviews - a.totalReviews;
        default: return 0;
      }
    });
  }, [managers, search, sort]);

  return (
    <div>
      {/* Controls */}
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: 24,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <input
          type="text"
          placeholder="Search management companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 220,
            padding: "8px 14px",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            fontSize: 14,
            color: "#1f2328",
            background: "#fff",
          }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            padding: "8px 14px",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            fontSize: 13,
            color: "#1f2328",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="rating">Highest Rated</option>
          <option value="buildings">Most Buildings</option>
          <option value="response">Best Response Rate</option>
          <option value="reviews">Most Reviews</option>
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p style={{ fontSize: 14, color: "#57606a", textAlign: "center", padding: "40px 0" }}>
          {search ? "No companies match your search." : "No management companies found."}
        </p>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14,
        }}>
          {filtered.map((m) => {
            const rc = m.avgRating > 0 ? getRatingColor(m.avgRating) : null;
            return (
              <a
                key={m.slug}
                href={`/manager/${m.slug}`}
                style={{
                  display: "block",
                  padding: "18px 20px",
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e8ecf0",
                  textDecoration: "none",
                  color: "#1f2328",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  {m.logo_url ? (
                    <img
                      src={m.logo_url}
                      alt={m.company_name}
                      style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", border: "1px solid #e8ecf0" }}
                    />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, background: "#1f6feb",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0,
                    }}>
                      {m.company_name[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0969da" }}>
                    {m.company_name}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#57606a" }}>
                    {m.totalBuildings} building{m.totalBuildings !== 1 ? "s" : ""}
                  </span>
                  {rc ? (
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      background: rc.bg,
                      color: rc.color,
                    }}>
                      {m.avgRating.toFixed(1)} / 5
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#8b949e" }}>No ratings</span>
                  )}
                  <span style={{ fontSize: 12, color: "#57606a" }}>
                    {m.totalReviews} review{m.totalReviews !== 1 ? "s" : ""}
                  </span>
                  {m.responseRate > 0 && (
                    <span style={{ fontSize: 11, color: "#57606a" }}>
                      {m.responseRate}% response
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
