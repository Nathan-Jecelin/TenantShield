export const metadata = { title: "Terms of Service — TenantShield" };

export default function Terms() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2328", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "#57606a", marginBottom: 32 }}>Last updated: February 18, 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Acceptance of Terms</h2>
      <p>By using TenantShield, you agree to these terms. If you do not agree, please do not use the service.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Description of Service</h2>
      <p>TenantShield is a platform for Chicago renters to search landlord reviews, view building violations, and access 311 complaint records from public city data. The service is provided free of charge.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>User Accounts</h2>
      <p>You may create an account using email/password or Google sign-in. You are responsible for maintaining the security of your account credentials.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>User Reviews</h2>
      <p>By submitting a review, you affirm that:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>Your review is based on your genuine experience as a tenant</li>
        <li>The information you provide is truthful and accurate to the best of your knowledge</li>
        <li>Your review does not contain defamatory, abusive, or illegal content</li>
      </ul>
      <p>We reserve the right to remove reviews that violate these guidelines.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Public Data</h2>
      <p>Building violations and 311 service request data is sourced from the Chicago Open Data Portal and is provided as-is. TenantShield does not guarantee the accuracy or completeness of this data.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Limitation of Liability</h2>
      <p>TenantShield is provided "as is" without warranties of any kind. We are not liable for decisions made based on information found on this platform.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Changes to Terms</h2>
      <p>We may update these terms from time to time. Continued use of the service constitutes acceptance of any changes.</p>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e8ecf0" }}>
        <a href="/" style={{ color: "#1f6feb", textDecoration: "none", fontWeight: 600 }}>← Back to TenantShield</a>
      </div>
    </div>
  );
}
