export const metadata = { title: "Privacy Policy — TenantShield" };

export default function Privacy() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2328", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#57606a", marginBottom: 32 }}>Last updated: February 18, 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>What We Collect</h2>
      <p>When you create an account or sign in with Google, we collect your email address and basic profile information provided by Google (name and profile picture). When you submit a review, we store the review content, rating, and associated address.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>How We Use Your Information</h2>
      <p>Your information is used to:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>Authenticate your account and manage your session</li>
        <li>Display your reviews on the platform</li>
        <li>Improve the service through anonymous usage analytics (search queries, page views)</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Data from Public Sources</h2>
      <p>TenantShield displays publicly available data from the Chicago Open Data Portal, including building violations and 311 service requests. This data is provided by the City of Chicago and is public record.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Data Sharing</h2>
      <p>We do not sell, trade, or share your personal information with third parties. Your data is stored securely using Supabase infrastructure.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Analytics</h2>
      <p>We use Google Analytics to understand how visitors interact with TenantShield. Google Analytics collects information such as pages visited, time spent on pages, and general location (city/country level). This data is aggregated and anonymous — it does not personally identify you. Google may use cookies to distinguish unique users. You can opt out of Google Analytics by installing the <a href="https://tools.google.com/dlpage/gaoptout" style={{ color: "#1f6feb", textDecoration: "none" }}>Google Analytics Opt-out Browser Add-on</a>.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Newsletter</h2>
      <p>If you subscribe to our newsletter, we collect your email address to send weekly updates about new blog posts, tenant reviews, and Chicago renter news. Emails are sent via <a href="https://resend.com" style={{ color: "#1f6feb", textDecoration: "none" }}>Resend</a>. You can unsubscribe at any time using the link in every email. Your email is stored securely and is never shared with third parties.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Cookies</h2>
      <p>We use essential cookies for authentication sessions. We also use cookies set by Google Analytics to measure site usage. We do not use advertising cookies.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Your Rights</h2>
      <p>You can request deletion of your account and associated data at any time by contacting us.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact</h2>
      <p>For questions about this privacy policy, reach out via the TenantShield platform.</p>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e8ecf0" }}>
        <a href="/" style={{ color: "#1f6feb", textDecoration: "none", fontWeight: 600 }}>← Back to TenantShield</a>
      </div>
    </div>
  );
}
