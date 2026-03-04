import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { Resend } from "resend";
import { addressToSlug } from "@/lib/slugs";

const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabase || !resendKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Find captures: report sent, no follow-up yet, created 14+ days ago
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: captures, error } = await supabase
    .from("email_captures")
    .select("id, email, address, building_name")
    .eq("report_sent", true)
    .eq("followup_sent", false)
    .lt("created_at", cutoff)
    .limit(200);

  if (error) {
    console.error("Follow-up query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!captures || captures.length === 0) {
    return NextResponse.json({ message: "No follow-ups due.", sent: 0 });
  }

  const resend = new Resend(resendKey);
  const siteUrl = "https://mytenantshield.com";
  let totalSent = 0;

  // Build emails
  const emails = captures.map((c) => {
    const slug = addressToSlug(c.address);
    const buildingUrl = `${siteUrl}/buildings/${slug}`;
    return {
      captureId: c.id,
      payload: {
        from: "TenantShield <reports@mytenantshield.com>",
        to: c.email,
        subject: "Still apartment hunting?",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1f6feb; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; font-size: 20px; margin: 0;">TenantShield</h1>
            </div>
            <div style="border: 1px solid #e8ecf0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; color: #1f2328; margin: 0 0 12px;">Hi there!</p>
              <p style="font-size: 14px; color: #57606a; line-height: 1.6; margin: 0 0 16px;">
                A couple weeks ago you downloaded a report for <strong>${c.address}</strong>.
                Have you had a chance to visit or live in this building?
              </p>
              <p style="font-size: 14px; color: #57606a; line-height: 1.6; margin: 0 0 20px;">
                Your review helps other Chicago renters make informed decisions.
                It only takes a minute!
              </p>
              <a href="${buildingUrl}#review" style="display: inline-block; padding: 10px 24px; background: #2da44e; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Leave a Review
              </a>
              <hr style="border: none; border-top: 1px solid #e8ecf0; margin: 24px 0;" />
              <p style="font-size: 11px; color: #8b949e; margin: 0;">
                © ${new Date().getFullYear()} TenantShield — mytenantshield.com
              </p>
            </div>
          </div>
        `,
      },
    };
  });

  // Send in batches
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(batch.map((e) => e.payload));
      const ids = batch.map((e) => e.captureId);
      await supabase
        .from("email_captures")
        .update({ followup_sent: true, followup_sent_at: new Date().toISOString() })
        .in("id", ids);
      totalSent += batch.length;
    } catch (err) {
      console.error("Resend batch error:", err);
    }
  }

  return NextResponse.json({ message: "Follow-ups sent.", sent: totalSent });
}
