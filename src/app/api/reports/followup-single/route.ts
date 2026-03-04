import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { Resend } from "resend";
import { addressToSlug } from "@/lib/slugs";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.captureId) {
    return NextResponse.json({ error: "captureId required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabase || !resendKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: capture, error } = await supabase
    .from("email_captures")
    .select("id, email, address, building_name")
    .eq("id", body.captureId)
    .single();

  if (error || !capture) {
    return NextResponse.json({ error: "Capture not found" }, { status: 404 });
  }

  const resend = new Resend(resendKey);
  const slug = addressToSlug(capture.address);
  const buildingUrl = `https://mytenantshield.com/buildings/${slug}`;

  try {
    await resend.emails.send({
      from: "TenantShield <reports@mytenantshield.com>",
      to: capture.email,
      subject: "Still apartment hunting?",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1f6feb; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; font-size: 20px; margin: 0;">TenantShield</h1>
          </div>
          <div style="border: 1px solid #e8ecf0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #1f2328; margin: 0 0 12px;">Hi there!</p>
            <p style="font-size: 14px; color: #57606a; line-height: 1.6; margin: 0 0 16px;">
              A couple weeks ago you downloaded a report for <strong>${capture.address}</strong>.
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
    });

    await supabase
      .from("email_captures")
      .update({ followup_sent: true, followup_sent_at: new Date().toISOString() })
      .eq("id", capture.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Follow-up single send error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
