"use client";

import React from "react";

export function Nav() {
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
      <a
        href="/"
        style={{
          fontSize: 13,
          color: "#1f6feb",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Back to Home
      </a>
    </nav>
  );
}

export function Footer() {
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

export function GoogleOAuthButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        padding: "12px 28px",
        background: "#fff",
        border: "1px solid #d0d7de",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 600,
        color: "#1f2328",
        cursor: "pointer",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      Sign in with Google
    </button>
  );
}

export function Divider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "20px 0",
      }}
    >
      <div style={{ flex: 1, height: 1, background: "#e8ecf0" }} />
      <span style={{ fontSize: 12, color: "#8b949e" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "#e8ecf0" }} />
    </div>
  );
}

export const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f8fa",
  color: "#1f2328",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#1f2328",
  marginBottom: 18,
};

export const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  border: "1px solid #d0d7de",
  borderRadius: 6,
  fontSize: 14,
  color: "#1f2328",
  background: "#fff",
  boxSizing: "border-box",
};

export const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 0",
  background: "#1f6feb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

export const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e8ecf0",
  borderRadius: 8,
  padding: "48px 36px",
};

export const linkStyle: React.CSSProperties = {
  color: "#1f6feb",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
};
