import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { Resend } from 'resend';
import {
  fetchBuildingViolations,
  fetchServiceRequests,
  parseStreetAddress,
  generateAddressVariants,
} from '@/lib/chicagoData';
import { addressToSlug } from '@/lib/slugs';

const BATCH_SIZE = 50;

interface ClaimedRow {
  id: string;
  address: string;
  landlord_id: string;
  last_violation_count: number;
  last_complaint_count: number;
  landlord_profiles: {
    contact_email: string | null;
  };
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabase || !resendKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Fetch all claimed buildings with pending/approved status, joined with landlord email
  const { data: buildings, error: fetchError } = await supabase
    .from('claimed_buildings')
    .select('id, address, landlord_id, last_violation_count, last_complaint_count, landlord_profiles(contact_email)')
    .in('verification_status', ['pending', 'approved']);

  if (fetchError) {
    console.error('Failed to fetch claimed buildings:', fetchError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!buildings || buildings.length === 0) {
    return NextResponse.json({ message: 'No claimed buildings.', checked: 0, notified: 0 });
  }

  const resend = new Resend(resendKey);
  const siteUrl = 'https://mytenantshield.com';
  const now = new Date().toISOString();

  let totalChecked = 0;
  let totalNotified = 0;
  const pendingEmails: { from: string; to: string; subject: string; html: string }[] = [];

  for (const building of buildings as unknown as ClaimedRow[]) {
    totalChecked++;
    const { address } = building;

    try {
      const parsed = parseStreetAddress(address);
      const variants = generateAddressVariants(parsed);
      const [violations, complaints] = await Promise.all([
        fetchBuildingViolations(variants),
        fetchServiceRequests(variants),
      ]);

      const currentViolations = violations.length;
      const currentComplaints = complaints.length;
      const newViolations = Math.max(0, currentViolations - building.last_violation_count);
      const newComplaints = Math.max(0, currentComplaints - building.last_complaint_count);

      if (newViolations > 0 || newComplaints > 0) {
        // Determine severity based on count
        const total = newViolations + newComplaints;
        const severity = total >= 5 ? 'high' : total >= 2 ? 'medium' : 'low';

        // Insert alert rows
        const alertRows: { landlord_id: string; building_id: string; alert_type: string; title: string; description: string; severity: string }[] = [];

        if (newViolations > 0) {
          alertRows.push({
            landlord_id: building.landlord_id,
            building_id: building.id,
            alert_type: 'violation',
            title: `${newViolations} new violation${newViolations === 1 ? '' : 's'} at ${address}`,
            description: `${newViolations} new building violation${newViolations === 1 ? ' was' : 's were'} found at ${address}. Total violations: ${currentViolations}.`,
            severity,
          });
        }

        if (newComplaints > 0) {
          alertRows.push({
            landlord_id: building.landlord_id,
            building_id: building.id,
            alert_type: '311_complaint',
            title: `${newComplaints} new 311 complaint${newComplaints === 1 ? '' : 's'} at ${address}`,
            description: `${newComplaints} new 311 complaint${newComplaints === 1 ? ' was' : 's were'} filed for ${address}. Total complaints: ${currentComplaints}.`,
            severity,
          });
        }

        await supabase.from('landlord_alerts').insert(alertRows);

        // Queue email if landlord has contact email
        const email = building.landlord_profiles?.contact_email;
        if (email) {
          const changes: string[] = [];
          if (newViolations > 0) changes.push(`${newViolations} new violation${newViolations === 1 ? '' : 's'}`);
          if (newComplaints > 0) changes.push(`${newComplaints} new complaint${newComplaints === 1 ? '' : 's'}`);
          const changeSummary = changes.join(' and ');

          pendingEmails.push({
            from: 'TenantShield <alerts@mytenantshield.com>',
            to: email,
            subject: `TenantShield Alert: ${changeSummary} at ${address}`,
            html: buildAlertEmail(address, changeSummary, newViolations, newComplaints, siteUrl),
          });
          totalNotified++;
        }
      }

      // Update baseline counts
      await supabase
        .from('claimed_buildings')
        .update({
          last_violation_count: currentViolations,
          last_complaint_count: currentComplaints,
          last_checked_at: now,
        })
        .eq('id', building.id);
    } catch (err) {
      console.error(`Error checking building "${address}":`, err);
    }
  }

  // Send alert emails in batches
  for (let i = 0; i < pendingEmails.length; i += BATCH_SIZE) {
    const batch = pendingEmails.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(batch);
    } catch (err) {
      console.error('Resend batch error:', err);
    }
  }

  return NextResponse.json({
    message: `Checked ${totalChecked} buildings, notified ${totalNotified} landlords.`,
    checked: totalChecked,
    notified: totalNotified,
  });
}

function buildAlertEmail(
  address: string,
  changeSummary: string,
  newViolations: number,
  newComplaints: number,
  siteUrl: string,
): string {
  const addressSlug = addressToSlug(address);

  let detailRows = '';
  if (newViolations > 0) {
    detailRows += `
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#1f2328;border-bottom:1px solid #f0f0f0">Building Violations</td>
          <td style="padding:10px 0;font-size:14px;font-weight:600;color:#1f2328;text-align:right;border-bottom:1px solid #f0f0f0">+${newViolations} new</td>
        </tr>`;
  }
  if (newComplaints > 0) {
    detailRows += `
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#1f2328">311 Complaints</td>
          <td style="padding:10px 0;font-size:14px;font-weight:600;color:#1f2328;text-align:right">+${newComplaints} new</td>
        </tr>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a6deb,#0550ae);border-radius:12px 12px 0 0;padding:28px 24px;text-align:center">
      <h1 style="font-size:20px;color:#ffffff;margin:0 0 6px;font-weight:700;letter-spacing:-0.3px">New Activity on Your Building</h1>
      <p style="font-size:13px;color:rgba(255,255,255,0.75);margin:0">${changeSummary}</p>
    </div>

    <!-- Main content -->
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px 24px;border:1px solid #e2e8f0;border-top:none">

      <div style="background:#f6f8fa;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid #e8ecf0">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8b949e;margin-bottom:6px;font-weight:600">Building</div>
        <div style="font-size:16px;font-weight:600;color:#1f2328">${address}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        ${detailRows}
      </table>

      <div style="text-align:center;margin-bottom:12px">
        <a href="${siteUrl}/landlord/dashboard/alerts" style="display:inline-block;padding:12px 32px;background:#1f6feb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Dashboard Alerts</a>
      </div>
      <div style="text-align:center">
        <a href="${siteUrl}/address/${addressSlug}" style="font-size:13px;color:#1f6feb;text-decoration:none;font-weight:600">View Full Building Report &rarr;</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;font-size:12px;color:#8b949e;line-height:1.8">
      <div>TenantShield &middot; Protecting Chicago renters</div>
      <div style="margin-top:4px">
        <a href="${siteUrl}" style="color:#8b949e;text-decoration:none">Home</a>
        &nbsp;&middot;&nbsp;
        <a href="${siteUrl}/privacy" style="color:#8b949e;text-decoration:none">Privacy</a>
      </div>
    </div>

  </div>
</body>
</html>`;
}
