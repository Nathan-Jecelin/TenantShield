"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import { companyNameToSlug } from "@/lib/slugs";

interface LandlordProfile {
  id: string;
  company_name: string | null;
  contact_email: string | null;
  plan: string;
  plan_status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  verified: boolean;
  slug: string | null;
  bio: string | null;
  website: string | null;
  public_phone: string | null;
  public_email: string | null;
  logo_url: string | null;
  years_in_business: number | null;
  profile_visible: boolean;
}

export default function LandlordSettings() {
  const auth = useAuth();
  const [profile, setProfile] = useState<LandlordProfile | null | undefined>(undefined);
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    company_name: "",
    bio: "",
    website: "",
    public_email: "",
    public_phone: "",
    years_in_business: "" as string,
    profile_visible: true,
    logo_url: "" as string,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: prof } = await sb
      .from("landlord_profiles")
      .select("id, company_name, contact_email, plan, plan_status, current_period_end, stripe_customer_id, verified, slug, bio, website, public_phone, public_email, logo_url, years_in_business, profile_visible")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) {
      window.location.href = "/landlord/signup";
      return;
    }
    setProfile(prof);
    setProfileForm({
      company_name: prof.company_name || "",
      bio: prof.bio || "",
      website: prof.website || "",
      public_email: prof.public_email || "",
      public_phone: prof.public_phone || "",
      years_in_business: prof.years_in_business != null ? String(prof.years_in_business) : "",
      profile_visible: prof.profile_visible ?? true,
      logo_url: prof.logo_url || "",
    });
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      window.location.href = "/landlord/signup";
      return;
    }
    loadData(auth.user.id);
  }, [auth.loading, auth.user, loadData]);

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

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPortalLoading(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2 MB."); return; }

    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/logo.${ext}`;
      const sb = getSupabase()!;
      const { error } = await sb.storage.from("logos").upload(path, file, { upsert: true });
      if (error) { alert("Upload failed: " + error.message); return; }
      const { data: urlData } = sb.storage.from("logos").getPublicUrl(path);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      setProfileForm((f) => ({ ...f, logo_url: publicUrl }));
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function handleProfileSave() {
    if (!profile) return;
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const sb = getSupabase();
      if (!sb) return;

      // Auto-generate slug on first save if not set
      let slug = profile.slug;
      if (!slug && profileForm.company_name.trim()) {
        slug = companyNameToSlug(profileForm.company_name.trim());
      }

      const updates: Record<string, unknown> = {
        company_name: profileForm.company_name.trim() || null,
        bio: profileForm.bio.trim().slice(0, 500) || null,
        website: profileForm.website.trim() || null,
        public_email: profileForm.public_email.trim() || null,
        public_phone: profileForm.public_phone.trim() || null,
        years_in_business: profileForm.years_in_business ? parseInt(profileForm.years_in_business, 10) || null : null,
        profile_visible: profileForm.profile_visible,
        logo_url: profileForm.logo_url || null,
        updated_at: new Date().toISOString(),
      };
      // Only set slug if it wasn't already set
      if (!profile.slug && slug) {
        updates.slug = slug;
      }

      const { error } = await sb
        .from("landlord_profiles")
        .update(updates)
        .eq("id", profile.id);

      if (error) {
        alert("Save failed: " + error.message);
        return;
      }

      // Update local profile with new slug
      setProfile((p) => p ? { ...p, ...updates, slug: updates.slug as string ?? p.slug } as LandlordProfile : p);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setProfileSaving(false);
    }
  }

  if (auth.loading || (auth.user && profile === undefined)) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Loading settings...</div>
        <Footer />
      </div>
    );
  }

  if (!auth.user || !profile) {
    return (
      <div style={pageStyle}>
        <DashNav onLogout={auth.signOut} />
        <div style={loadingStyle}>Redirecting...</div>
        <Footer />
      </div>
    );
  }

  const isPro = profile.plan === "pro";

  return (
    <div style={pageStyle}>
      <DashNav onLogout={auth.signOut} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px" }}>
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

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2328", margin: "0 0 24px" }}>
          Settings
        </h1>

        {/* Billing section */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: "0 0 16px" }}>
            Billing &amp; Subscription
          </h2>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              background: isPro ? "linear-gradient(135deg, #dbeafe 0%, #d1fae5 100%)" : "#f6f8fa",
              borderRadius: 8,
              border: isPro ? "1px solid #93c5fd" : "1px solid #e8ecf0",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isPro ? "#1e40af" : "#57606a",
                  }}
                >
                  {isPro ? "Pro Plan" : "Free Plan"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: isPro ? "#bfdbfe" : "#e8ecf0",
                    color: isPro ? "#1e40af" : "#57606a",
                  }}
                >
                  {isPro ? "$49/mo" : "$0/mo"}
                </span>
              </div>
              {isPro && profile.current_period_end && (
                <p style={{ fontSize: 12, color: "#57606a", margin: 0 }}>
                  Next billing date: {new Date(profile.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
              {isPro && profile.plan_status === "past_due" && (
                <p style={{ fontSize: 12, color: "#cf222e", margin: "4px 0 0", fontWeight: 600 }}>
                  Payment past due — please update your billing info.
                </p>
              )}
              {!isPro && (
                <p style={{ fontSize: 12, color: "#57606a", margin: 0 }}>
                  1 building, violations, complaints, building score
                </p>
              )}
            </div>

            {isPro ? (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                style={{
                  padding: "8px 18px",
                  background: "none",
                  border: "1px solid #d0d7de",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#57606a",
                  cursor: "pointer",
                  opacity: portalLoading ? 0.7 : 1,
                }}
              >
                {portalLoading ? "Loading..." : "Manage Billing"}
              </button>
            ) : (
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
            )}
          </div>

          {/* Feature comparison */}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#57606a", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Plan Features
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0", fontSize: 13 }}>
              <div style={featureHeaderStyle}>Feature</div>
              <div style={{ ...featureHeaderStyle, textAlign: "center" }}>Free</div>
              <div style={{ ...featureHeaderStyle, textAlign: "center" }}>Pro</div>

              <FeatureRow label="View violations" free pro />
              <FeatureRow label="View complaints" free pro />
              <FeatureRow label="Building score" free pro />
              <FeatureRow label="Claim buildings" free="1" pro="Unlimited" />
              <FeatureRow label="Alerts" pro />
              <FeatureRow label="Respond to violations" pro />
              <FeatureRow label="Verified badge" pro />
              <FeatureRow label="Neighborhood benchmarks" pro />
            </div>
          </div>
        </div>

        {/* Public Profile section */}
        <div style={{ ...cardStyle, marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: "0 0 16px" }}>
            Public Profile
          </h2>
          <p style={{ fontSize: 13, color: "#57606a", margin: "0 0 20px" }}>
            This information is shown on your public management company profile page.
          </p>

          <div style={{ display: "grid", gap: 16 }}>
            {/* Company Name */}
            <div>
              <label style={labelStyle}>Company Name</label>
              <input
                type="text"
                value={profileForm.company_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="Acme Property Management"
                style={inputStyle}
              />
            </div>

            {/* Bio */}
            <div>
              <label style={labelStyle}>Bio / Description</label>
              <textarea
                value={profileForm.bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value.slice(0, 500) }))}
                placeholder="Tell tenants about your company..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>
                {profileForm.bio.length}/500 characters
              </div>
            </div>

            {/* Website */}
            <div>
              <label style={labelStyle}>Website URL</label>
              <input
                type="text"
                value={profileForm.website}
                onChange={(e) => setProfileForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
                style={inputStyle}
              />
            </div>

            {/* Public Email & Phone */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Public Contact Email</label>
                <input
                  type="email"
                  value={profileForm.public_email}
                  onChange={(e) => setProfileForm((f) => ({ ...f, public_email: e.target.value }))}
                  placeholder="info@example.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Public Phone</label>
                <input
                  type="tel"
                  value={profileForm.public_phone}
                  onChange={(e) => setProfileForm((f) => ({ ...f, public_phone: e.target.value }))}
                  placeholder="(312) 555-0100"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Years in Business */}
            <div>
              <label style={labelStyle}>Years in Business</label>
              <input
                type="number"
                min="0"
                max="200"
                value={profileForm.years_in_business}
                onChange={(e) => setProfileForm((f) => ({ ...f, years_in_business: e.target.value }))}
                placeholder="10"
                style={{ ...inputStyle, maxWidth: 120 }}
              />
            </div>

            {/* Logo Upload */}
            <div>
              <label style={labelStyle}>Company Logo</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {profileForm.logo_url ? (
                  <img
                    src={profileForm.logo_url}
                    alt="Logo"
                    style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid #e8ecf0" }}
                  />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: 10, background: "#1f6feb",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 700, color: "#fff",
                  }}>
                    {(profileForm.company_name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    style={{
                      padding: "6px 14px",
                      background: "none",
                      border: "1px solid #d0d7de",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#57606a",
                      cursor: "pointer",
                      opacity: logoUploading ? 0.7 : 1,
                    }}
                  >
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ display: "none" }}
                  />
                  <p style={{ fontSize: 11, color: "#8b949e", margin: "4px 0 0" }}>Max 2 MB, JPG or PNG</p>
                </div>
              </div>
            </div>

            {/* Profile Visible Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={profileForm.profile_visible}
                onChange={(e) => setProfileForm((f) => ({ ...f, profile_visible: e.target.checked }))}
                id="profile_visible"
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <label htmlFor="profile_visible" style={{ fontSize: 13, color: "#1f2328", cursor: "pointer" }}>
                Profile visible to the public
              </label>
            </div>

            {/* Save + View Profile */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                style={{
                  padding: "8px 20px",
                  background: "#1f6feb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: profileSaving ? 0.7 : 1,
                }}
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
              {profileSaved && (
                <span style={{ fontSize: 13, color: "#1a7f37", fontWeight: 600 }}>Saved!</span>
              )}
              {(profile.slug || profileForm.company_name) && (
                <a
                  href={`/manager/${profile.slug || companyNameToSlug(profileForm.company_name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: "#0969da", textDecoration: "none", fontWeight: 600 }}
                >
                  View Public Profile &rarr;
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function FeatureRow({ label, free, pro }: { label: string; free?: boolean | string; pro?: boolean | string }) {
  return (
    <>
      <div style={featureCellStyle}>{label}</div>
      <div style={{ ...featureCellStyle, textAlign: "center" }}>
        {free === true ? "✓" : free === false || free === undefined ? "—" : free}
      </div>
      <div style={{ ...featureCellStyle, textAlign: "center", color: pro ? "#1a7f37" : "#8b949e" }}>
        {pro === true ? "✓" : pro === false || pro === undefined ? "—" : pro}
      </div>
    </>
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

const featureHeaderStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 600,
  color: "#57606a",
  borderBottom: "1px solid #e8ecf0",
};

const featureCellStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #f0f3f6",
  color: "#1f2328",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#1f2328",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #d0d7de",
  borderRadius: 6,
  fontSize: 14,
  color: "#1f2328",
  background: "#fff",
  boxSizing: "border-box",
};
