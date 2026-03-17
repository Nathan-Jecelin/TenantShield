"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { Nav, Footer, pageStyle, cardStyle } from "@/components/landlord-shared";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setStatus("error");
      setErrorMsg("Unable to initialize. Please try again.");
      return;
    }

    // Supabase auto-exchanges the token from the URL hash.
    // Listen for the auth state change to confirm verification.
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) return;

      // Create landlord_profiles row using company_name from user metadata
      const user = session.user;
      const companyName =
        user.user_metadata?.company_name || "";

      try {
        // Check if profile already exists (e.g. Google OAuth user)
        const { data: existing } = await sb
          .from("landlord_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existing) {
          const { error: insertErr } = await sb
            .from("landlord_profiles")
            .insert({
              user_id: user.id,
              company_name: companyName || null,
              contact_email: user.email || "",
            });

          if (insertErr) {
            setStatus("error");
            setErrorMsg(insertErr.message);
            return;
          }
        }

        setStatus("success");
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          window.location.href = "/landlord/dashboard";
        }, 2000);
      } catch {
        setStatus("error");
        setErrorMsg("Something went wrong creating your profile.");
      }
    });

    // Fallback: if already authenticated (e.g. page reload), handle directly
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        // Give Supabase a moment to process the token from URL
        setTimeout(() => {
          setStatus((prev) => (prev === "loading" ? "error" : prev));
          setErrorMsg((prev) =>
            prev || "Verification link may be expired or invalid. Please try signing up again."
          );
        }, 5000);
        return;
      }

      const user = session.user;
      const companyName = user.user_metadata?.company_name || "";

      const { data: existing } = await sb
        .from("landlord_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await sb
          .from("landlord_profiles")
          .insert({
            user_id: user.id,
            company_name: companyName || null,
            contact_email: user.email || "",
          });

        if (insertErr) {
          setStatus("error");
          setErrorMsg(insertErr.message);
          return;
        }
      }

      setStatus("success");
      setTimeout(() => {
        window.location.href = "/landlord/dashboard";
      }, 2000);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={pageStyle}>
      <Nav />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "64px 20px" }}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          {status === "loading" && (
            <>
              <p
                style={{
                  fontSize: 15,
                  color: "#57606a",
                  margin: 0,
                }}
              >
                Verifying your email...
              </p>
            </>
          )}
          {status === "success" && (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1a7f37"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 16 }}
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#1f2328",
                  margin: "0 0 8px",
                }}
              >
                Email verified!
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "#57606a",
                  margin: "0 0 4px",
                  lineHeight: 1.6,
                }}
              >
                Your account is set up. Redirecting to your dashboard...
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#cf222e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 16 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#1f2328",
                  margin: "0 0 8px",
                }}
              >
                Verification failed
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "#57606a",
                  margin: "0 0 20px",
                  lineHeight: 1.6,
                }}
              >
                {errorMsg}
              </p>
              <a
                href="/landlord/signup"
                style={{
                  color: "#1f6feb",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Back to sign up
              </a>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
