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

function getGrade(rating: number): { grade: string; color: string; bg: string } {
  if (rating >= 4.5) return { grade: "A", color: "#1a7f37", bg: "#dafbe1" };
  if (rating >= 3.5) return { grade: "B", color: "#0969da", bg: "#ddf4ff" };
  if (rating >= 2.5) return { grade: "C", color: "#9a6700", bg: "#fff8c5" };
  if (rating >= 1.5) return { grade: "D", color: "#bc4c00", bg: "#fff1e5" };
  return { grade: "F", color: "#cf222e", bg: "#ffebe9" };
}

export default function ManagerProfile({ profile, buildings, stats }: ManagerProfileProps) {
  const initial = (profile.company_name || "?")[0].toUpperCase();
  const gradeInfo = stats.avgRating > 0 ? getGrade(stats.avgRating) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f6f8fa",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    }}>
      {/* Header Nav */}
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #e8ecf0",
        padding: "12px 0",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1f6feb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 17, color: "#1f2328", letterSpacing: -0.3 }}>TenantShield</span>
          </a>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/managers" style={{ padding: "7px 16px", background: "#f6f8fa", border: "1px solid #d0d7de", borderRadius: 6, fontSize: 13, color: "#57606a", textDecoration: "none", fontWeight: 600 }}>
              All Managers
            </a>
            <a href="/landlord/dashboard" style={{ padding: "7px 16px", background: "#f6f8fa", border: "1px solid #d0d7de", borderRadius: 6, fontSize: 13, color: "#57606a", textDecoration: "none", fontWeight: 600 }}>
              Landlord Portal
            </a>
          </div>
        </div>
      </header>

      {/* Glassdoor-style Profile Hero */}
      <div style={{
        background: "linear-gradient(135deg, #0a2540 0%, #1a3a5c 50%, #0d4f8b 100%)",
        padding: "48px 20px 0",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle pattern overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 20% 50%, rgba(31,111,235,0.15), transparent 60%), radial-gradient(circle at 80% 20%, rgba(31,111,235,0.1), transparent 50%)",
        }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Breadcrumb */}
          <nav style={{ fontSize: 13, marginBottom: 24 }}>
            <a href="/" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Home</a>
            <span style={{ margin: "0 6px", color: "rgba(255,255,255,0.4)" }}>/</span>
            <a href="/managers" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Managers</a>
            <span style={{ margin: "0 6px", color: "rgba(255,255,255,0.4)" }}>/</span>
            <span style={{ color: "#fff" }}>{profile.company_name || "Company"}</span>
          </nav>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap", paddingBottom: 32 }}>
            {/* Logo */}
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt={profile.company_name || "Logo"}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 16,
                  objectFit: "cover",
                  border: "3px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                }}
              />
            ) : (
              <div style={{
                width: 96,
                height: 96,
                borderRadius: 16,
                background: "linear-gradient(135deg, #1f6feb, #388bfd)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 38,
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
                border: "3px solid rgba(255,255,255,0.2)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              }}>
                {initial}
              </div>
            )}

            {/* Name & Meta */}
            <div style={{ flex: 1, minWidth: 200, paddingBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <h1 style={{ fontSize: 32, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2 }}>
                  {profile.company_name || "Property Management"}
                </h1>
                {profile.verified && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: 20,
                    background: "rgba(26,127,55,0.2)",
                    color: "#6ee7b7",
                    border: "1px solid rgba(110,231,183,0.3)",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#6ee7b7">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 12l2 2 4-4" stroke="#0a2540" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {profile.years_in_business && (
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {profile.years_in_business} year{profile.years_in_business !== 1 ? "s" : ""} in business
                  </span>
                )}
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  {stats.totalBuildings} building{stats.totalBuildings !== 1 ? "s" : ""} managed
                </span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {stats.totalReviews} review{stats.totalReviews !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Large Rating Display */}
            {stats.avgRating > 0 && gradeInfo && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 24px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                flexShrink: 0,
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  background: gradeInfo.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  color: gradeInfo.color,
                }}>
                  {gradeInfo.grade}
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                    {stats.avgRating.toFixed(1)}
                  </div>
                  <div style={{ display: "flex", gap: 2, margin: "4px 0" }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} style={{ fontSize: 14, color: s <= Math.round(stats.avgRating) ? "#f4a623" : "rgba(255,255,255,0.3)" }}>★</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    {stats.totalReviews} review{stats.totalReviews !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e8ecf0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 20px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
        }}>
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f6feb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
            label="Buildings Managed"
            value={String(stats.totalBuildings)}
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f4a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
            label="Average Rating"
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "N/A"}
            accent={stats.avgRating > 0 ? getRatingColor(stats.avgRating).color : undefined}
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
            label="Total Reviews"
            value={String(stats.totalReviews)}
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
            label="Response Rate"
            value={`${stats.responseRate}%`}
            progressPercent={stats.responseRate}
          />
        </div>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, alignItems: "start" }}>
          {/* Left Column - Buildings */}
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1f2328", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f6feb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Managed Buildings
            </h2>
            {buildings.length === 0 ? (
              <div style={{
                padding: "40px 24px",
                background: "#fff",
                border: "1px solid #e8ecf0",
                borderRadius: 10,
                textAlign: "center",
              }}>
                <p style={{ fontSize: 14, color: "#57606a" }}>No buildings listed yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {buildings.map((b) => {
                  const rc = b.avgRating > 0 ? getRatingColor(b.avgRating) : null;
                  return (
                    <a
                      key={b.slug}
                      href={`/address/${b.slug}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "20px 24px",
                        background: "#fff",
                        borderRadius: 10,
                        border: "1px solid #e8ecf0",
                        textDecoration: "none",
                        color: "#1f2328",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(31,111,235,0.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e8ecf0"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
                    >
                      {/* Building icon */}
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        background: "#f0f6ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1f6feb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="2" width="16" height="20" rx="2" />
                          <path d="M9 22V12h6v10" />
                          <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#0969da", marginBottom: 4 }}>
                          {b.address}
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          {rc ? (
                            <>
                              <div style={{ display: "flex", gap: 2 }}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <span key={s} style={{ fontSize: 13, color: s <= Math.round(b.avgRating) ? "#f4a623" : "#d1d5db" }}>★</span>
                                ))}
                              </div>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 600,
                                background: rc.bg,
                                color: rc.color,
                              }}>
                                {b.avgRating.toFixed(1)}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: 12, color: "#8b949e" }}>No ratings yet</span>
                          )}
                          <span style={{ fontSize: 12, color: "#57606a" }}>
                            {b.reviewCount} review{b.reviewCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column - About & Contact */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* About Card */}
            {(profile.bio || profile.website || profile.public_email || profile.public_phone) && (
              <div style={{
                background: "#fff",
                border: "1px solid #e8ecf0",
                borderRadius: 10,
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: "0 0 14px" }}>
                  About
                </h3>
                {profile.bio && (
                  <p style={{ fontSize: 14, color: "#424a53", lineHeight: 1.7, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>
                    {profile.bio}
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {profile.website && (
                    <a
                      href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0969da", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {profile.public_email && (
                    <a href={`mailto:${profile.public_email}`} style={{ color: "#0969da", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                      </svg>
                      {profile.public_email}
                    </a>
                  )}
                  {profile.public_phone && (
                    <span style={{ color: "#57606a", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {profile.public_phone}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CTA Card */}
            <div style={{
              background: "linear-gradient(135deg, #f0f6ff, #e8f4f8)",
              border: "1px solid #d4e4fb",
              borderRadius: 10,
              padding: "24px",
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1f2328", margin: "0 0 8px" }}>
                Is this your company?
              </h3>
              <p style={{ fontSize: 13, color: "#57606a", margin: "0 0 16px", lineHeight: 1.5 }}>
                Claim your profile to respond to reviews and showcase your properties.
              </p>
              <a
                href="/landlord/signup"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  background: "#1f6feb",
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Claim Profile
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #e8ecf0",
        background: "#fff",
        padding: "40px 20px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f6feb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#1f2328" }}>TenantShield</span>
            </div>
            <p style={{ fontSize: 12, color: "#8b949e", maxWidth: 240, lineHeight: 1.5 }}>
              Protecting Chicago renters with transparent building data and honest reviews.
            </p>
          </div>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1f2328", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>For Renters</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Search Buildings</a>
                <a href="/neighborhoods" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Neighborhoods</a>
                <a href="/blog" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Blog</a>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1f2328", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>For Landlords</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/landlord/signup" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Claim Your Building</a>
                <a href="/landlord/dashboard" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Dashboard</a>
                <a href="/managers" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Manager Directory</a>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1f2328", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Company</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/privacy" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Privacy Policy</a>
                <a href="/terms" style={{ fontSize: 13, color: "#57606a", textDecoration: "none" }}>Terms of Service</a>
              </div>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: "24px auto 0", paddingTop: 20, borderTop: "1px solid #e8ecf0", fontSize: 12, color: "#8b949e", textAlign: "center" }}>
          Public records sourced from the City of Chicago Open Data Portal · TenantShield 2026
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, accent, progressPercent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  progressPercent?: number;
}) {
  return (
    <div style={{
      padding: "20px 16px",
      textAlign: "center",
      borderRight: "1px solid #f0f3f6",
    }}>
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || "#1f2328", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#57606a", marginTop: 4, fontWeight: 500 }}>{label}</div>
      {progressPercent !== undefined && (
        <div style={{
          marginTop: 8,
          height: 4,
          borderRadius: 2,
          background: "#e8ecf0",
          overflow: "hidden",
          maxWidth: 80,
          marginLeft: "auto",
          marginRight: "auto",
        }}>
          <div style={{
            width: `${Math.min(progressPercent, 100)}%`,
            height: "100%",
            background: "#1a7f37",
            borderRadius: 2,
            transition: "width 0.6s ease",
          }} />
        </div>
      )}
    </div>
  );
}
