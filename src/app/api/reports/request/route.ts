import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { Resend } from "resend";
import {
  fetchBuildingViolations,
  fetchServiceRequests,
  parseStreetAddress,
  generateAddressVariants,
} from "@/lib/chicagoData";
import { addressToSlug } from "@/lib/slugs";
import { generateReport } from "@/lib/generateReport";

// Simple in-memory rate limit: 5 requests per minute per IP
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 5;
  const timestamps = (rateLimitMap.get(ip) || []).filter(
    (t) => now - t < window
  );
  if (timestamps.length >= max) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.address) {
    return NextResponse.json(
      { error: "Email and address are required." },
      { status: 400 }
    );
  }

  const email = String(body.email).trim().toLowerCase();
  const address = String(body.address).trim();
  const buildingName = String(body.buildingName || "").trim();

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabase || !resendKey) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  // Insert capture row
  const { data: capture, error: insertError } = await supabase
    .from("email_captures")
    .insert({ email, address, building_name: buildingName })
    .select("id")
    .single();

  if (insertError) {
    console.error("Email capture insert error:", insertError);
    return NextResponse.json(
      { error: "Failed to save request." },
      { status: 500 }
    );
  }

  // Fetch building data
  const parsed = parseStreetAddress(address);
  const variants = parsed ? generateAddressVariants(parsed) : [address.toUpperCase()];

  const [violations, complaints] = await Promise.all([
    fetchBuildingViolations(variants).catch(() => []),
    fetchServiceRequests(variants).catch(() => []),
  ]);

  // Fetch community reviews
  const { data: reviews } = await supabase
    .from("community_reviews")
    .select("author, rating, text, created_at")
    .eq("address", address)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);

  // Generate PDF
  const pdfBuffer = generateReport({
    address,
    buildingName,
    violations,
    complaints,
    reviews: reviews || [],
  });

  // Send email via Resend
  const resend = new Resend(resendKey);
  const slug = addressToSlug(address);
  const siteUrl = "https://mytenantshield.com";
  const trackingPixelUrl = `${siteUrl}/api/reports/track?id=${capture.id}`;
  const buildingPageUrl = `${siteUrl}/buildings/${slug}`;

  try {
    await resend.emails.send({
      from: "TenantShield <reports@mytenantshield.com>",
      to: email,
      subject: `Your Building Report for ${address}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1f6feb; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; font-size: 20px; margin: 0;">TenantShield</h1>
          </div>
          <div style="border: 1px solid #e8ecf0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #1f2328; margin: 0 0 8px;">Here's your building report for:</p>
            <p style="font-size: 18px; font-weight: 600; color: #1f2328; margin: 0 0 16px;">${address}</p>
            <p style="font-size: 14px; color: #57606a; line-height: 1.5; margin: 0 0 20px;">
              Your attached PDF includes violations, 311 complaints, and tenant reviews for this building.
              Check the full building profile for the latest updates.
            </p>
            <a href="${buildingPageUrl}" style="display: inline-block; padding: 10px 24px; background: #1f6feb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
              View Building Page
            </a>
            <hr style="border: none; border-top: 1px solid #e8ecf0; margin: 24px 0;" />
            <p style="font-size: 14px; color: #57606a; margin: 0 0 12px;">
              Have you lived in this building? Help other renters by sharing your experience.
            </p>
            <a href="${buildingPageUrl}#review" style="display: inline-block; padding: 8px 20px; background: #2da44e; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">
              Leave a Review
            </a>
            <p style="font-size: 11px; color: #8b949e; margin: 20px 0 0;">
              © ${new Date().getFullYear()} TenantShield — mytenantshield.com
            </p>
          </div>
          <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />
        </div>
      `,
      attachments: [
        {
          filename: `TenantShield-Report-${slug}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    // Mark report as sent
    await supabase
      .from("email_captures")
      .update({ report_sent: true })
      .eq("id", capture.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resend email error:", err);
    return NextResponse.json(
      { error: "Failed to send email. Please try again." },
      { status: 500 }
    );
  }
}
