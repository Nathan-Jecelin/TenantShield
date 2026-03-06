"use client";

interface BuildingStat {
  address: string;
  slug: string;
  avgRating: number;
  reviewCount: number;
}

interface ManagerProfileProps {
  profile: {
    company_name: string | null;
    bio: string | null;
    website: string | null;
    public_phone: string | null;
    public_email: string | null;
    logo_url: string | null;
    years_in_business: number | null;
    verified: boolean;
  };
  buildings: BuildingStat[];
  stats: {
    totalBuildings: number;
    avgRating: number;
    totalReviews: number;
    responseRate: number;
  };
}

function getRatingColor(r: number) {
  if (r >= 4) return { bg: "#dafbe1", color: "#1a7f37" };
  if (r >= 3) return { bg: "#fff8c5", color: "#9a6700" };
  return { bg: "#ffebe9", color: "#cf222e" };
}

export default function ManagerProfile({ profile, buildings, stats }: ManagerProfileProps) {
  const initial = (profile.company_name || "?")[0].toUpperCase();
  const ratingStyle = stats.avgRating > 0 ? getRatingColor(stats.avgRating) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fa" }}>
      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8ecf0", padding: "16px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#0969da" />
              <path d="M18 6L8 12v8c0 7 4.5 13.5 10 15.5 5.5-2 10-8.5 10-15.5v-8L18 6z" fill="#fff" fillOpacity=".9" />
              <path d="M14 18l3 3 5-5" stroke="#0969da" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#1f2328" }}>TenantShield</span>
          </a>
        </div>
      </header>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 0" }}>
        <nav style={{ fontSize: 13, color: "#8b949e" }}>
          <a href="/" style={{ color: "#0969da", textDecoration: "none" }}>Home</a>
          <span style={{ margin: "0 6px" }}>/</span>
          <a href="/managers" style={{ color: "#0969da", textDecoration: "none" }}>Managers</a>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#1f2328" }}>{profile.company_name || "Company"}</span>
        </nav>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Profile Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 24,
          flexWrap: "wrap",
        }}>
          {profile.logo_url ? (
            <img
              src={profile.logo_url}
              alt={profile.company_name || "Logo"}
              style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid #e8ecf0" }}
            />
          ) : (
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              background: "#1f6feb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}>
              {initial}
            </div>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1f2328", margin: 0 }}>
                {profile.company_name || "Property Management"}
              </h1>
              {profile.verified && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 10,
                  background: "#d1fae5",
                  color: "#065f46",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#065f46">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
            {profile.years_in_business && (
              <p style={{ fontSize: 14, color: "#57606a", margin: "4px 0 0" }}>
                {profile.years_in_business} year{profile.years_in_business !== 1 ? "s" : ""} in business
              </p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}>
          <StatCard label="Buildings" value={String(stats.totalBuildings)} />
          <StatCard
            label="Avg Rating"
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "N/A"}
            badge={ratingStyle}
          />
          <StatCard label="Reviews" value={String(stats.totalReviews)} />
          <StatCard
            label="Response Rate"
            value={`${stats.responseRate}%`}
            progressPercent={stats.responseRate}
          />
        </div>

        {/* About Section */}
        {(profile.bio || profile.website || profile.public_email || profile.public_phone) && (
          <div style={{
            background: "#fff",
            border: "1px solid #e8ecf0",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 28,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: "0 0 12px" }}>
              About
            </h2>
            {profile.bio && (
              <p style={{ fontSize: 14, color: "#1f2328", lineHeight: 1.6, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>
                {profile.bio}
              </p>
            )}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
              {profile.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0969da", textDecoration: "none" }}
                >
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {profile.public_email && (
                <a href={`mailto:${profile.public_email}`} style={{ color: "#0969da", textDecoration: "none" }}>
                  {profile.public_email}
                </a>
              )}
              {profile.public_phone && (
                <span style={{ color: "#57606a" }}>{profile.public_phone}</span>
              )}
            </div>
          </div>
        )}

        {/* Buildings Grid */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1f2328", margin: "0 0 14px" }}>
          Managed Buildings
        </h2>
        {buildings.length === 0 ? (
          <p style={{ fontSize: 14, color: "#57606a" }}>No buildings listed yet.</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}>
            {buildings.map((b) => {
              const rc = b.avgRating > 0 ? getRatingColor(b.avgRating) : null;
              return (
                <a
                  key={b.slug}
                  href={`/address/${b.slug}`}
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
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0969da", marginBottom: 8 }}>
                    {b.address}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {rc ? (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 600,
                        background: rc.bg,
                        color: rc.color,
                      }}>
                        {b.avgRating.toFixed(1)} / 5
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#8b949e" }}>No ratings</span>
                    )}
                    <span style={{ fontSize: 12, color: "#57606a" }}>
                      {b.reviewCount} review{b.reviewCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, badge, progressPercent }: {
  label: string;
  value: string;
  badge?: { bg: string; color: string } | null;
  progressPercent?: number;
}) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e8ecf0",
      borderRadius: 8,
      padding: "16px 18px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 12, color: "#57606a", marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {badge ? (
        <span style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 10,
          fontSize: 18,
          fontWeight: 700,
          background: badge.bg,
          color: badge.color,
        }}>
          {value}
        </span>
      ) : (
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2328" }}>{value}</div>
      )}
      {progressPercent !== undefined && (
        <div style={{
          marginTop: 6,
          height: 4,
          borderRadius: 2,
          background: "#e8ecf0",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${Math.min(progressPercent, 100)}%`,
            height: "100%",
            background: "#1f6feb",
            borderRadius: 2,
          }} />
        </div>
      )}
    </div>
  );
}
