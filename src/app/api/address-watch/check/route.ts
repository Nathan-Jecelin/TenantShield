import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { Resend } from 'resend';
import {
  fetchBuildingViolations,
  fetchServiceRequests,
  parseStreetAddress,
  generateAddressVariants,
} from '@/lib/chicagoData';

const BATCH_SIZE = 50;

interface WatchRow {
  id: string;
  email: string;
  address: string;
  last_violation_count: number;
  last_complaint_count: number;
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

  // Fetch all active watches
  const { data: watches, error: fetchError } = await supabase
    .from('address_watch')
    .select('id, email, address, last_violation_count, last_complaint_count')
    .eq('active', true);

  if (fetchError) {
    console.error('Failed to fetch watches:', fetchError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!watches || watches.length === 0) {
    return NextResponse.json({ message: 'No active watches.', checked: 0, notified: 0 });
  }

  // Group watchers by unique address
  const addressGroups = new Map<string, WatchRow[]>();
  for (const w of watches as WatchRow[]) {
    const key = w.address.toUpperCase().trim();
    const group = addressGroups.get(key) || [];
    group.push(w);
    addressGroups.set(key, group);
  }

  const resend = new Resend(resendKey);
  const siteUrl = 'https://mytenantshield.com';
  const now = new Date().toISOString();

  let totalChecked = 0;
  let totalNotified = 0;
  const pendingEmails: { from: string; to: string; subject: string; html: string }[] = [];
  const rowsToUpdate: { id: string; violationCount: number; complaintCount: number }[] = [];

  for (const [, watchers] of addressGroups) {
    const address = watchers[0].address;
    totalChecked++;

    try {
      const parsed = parseStreetAddress(address);
      const variants = generateAddressVariants(parsed);
      const [violations, complaints] = await Promise.all([
        fetchBuildingViolations(variants),
        fetchServiceRequests(variants),
      ]);

      const currentViolations = violations.length;
      const currentComplaints = complaints.length;

      // Use max stored count across all watchers for this address
      const maxStoredViolations = Math.max(...watchers.map((w) => w.last_violation_count));
      const maxStoredComplaints = Math.max(...watchers.map((w) => w.last_complaint_count));

      const newViolations = Math.max(0, currentViolations - maxStoredViolations);
      const newComplaints = Math.max(0, currentComplaints - maxStoredComplaints);

      if (newViolations > 0 || newComplaints > 0) {
        // Build change description
        const changes: string[] = [];
        if (newViolations > 0) changes.push(`${newViolations} new violation${newViolations === 1 ? '' : 's'}`);
        if (newComplaints > 0) changes.push(`${newComplaints} new complaint${newComplaints === 1 ? '' : 's'}`);
        const changeSummary = changes.join(' and ');

        for (const watcher of watchers) {
          pendingEmails.push({
            from: 'TenantShield <alerts@mytenantshield.com>',
            to: watcher.email,
            subject: `TenantShield Alert: ${changeSummary} at ${address}`,
            html: buildAlertEmail(address, changeSummary, newViolations, newComplaints, siteUrl),
          });
          totalNotified++;
        }
      }

      // Update all rows for this address with current counts
      for (const watcher of watchers) {
        rowsToUpdate.push({
          id: watcher.id,
          violationCount: currentViolations,
          complaintCount: currentComplaints,
        });
      }
    } catch (err) {
      console.error(`Error checking address "${address}":`, err);
      // Continue with other addresses
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

  // Update all watch rows with current counts
  for (const row of rowsToUpdate) {
    await supabase
      .from('address_watch')
      .update({
        last_violation_count: row.violationCount,
        last_complaint_count: row.complaintCount,
        last_checked_at: now,
      })
      .eq('id', row.id);
  }

  return NextResponse.json({
    message: `Checked ${totalChecked} addresses, notified ${totalNotified} watchers.`,
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
  const addressSlug = encodeURIComponent(address);

  let detailRows = '';
  if (newViolations > 0) {
    detailRows += `
        <tr>
          <td style="padding:8px 12px;font-size:14px;color:#1f2328;border-bottom:1px solid #e8ecf0">Building Violations</td>
          <td style="padding:8px 12px;font-size:14px;font-weight:600;color:#cf222e;text-align:right;border-bottom:1px solid #e8ecf0">+${newViolations} new</td>
        </tr>`;
  }
  if (newComplaints > 0) {
    detailRows += `
        <tr>
          <td style="padding:8px 12px;font-size:14px;color:#1f2328">311 Complaints</td>
          <td style="padding:8px 12px;font-size:14px;font-weight:600;color:#cf222e;text-align:right">+${newComplaints} new</td>
        </tr>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#cf222e,#da3633);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">&#x1f6a8;</div>
      <h1 style="font-size:22px;color:#ffffff;margin:0 0 4px;font-weight:700;letter-spacing:-0.3px">New Records Found</h1>
      <p style="font-size:13px;color:rgba(255,255,255,0.85);margin:0">${changeSummary}</p>
    </div>

    <!-- Main content -->
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px 24px;border:1px solid #e2e8f0;border-top:none">

      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid #e8ecf0">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8b949e;margin-bottom:6px;font-weight:600">Address</div>
        <div style="font-size:16px;font-weight:600;color:#1f2328">${address}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        ${detailRows}
      </table>

      <div style="text-align:center">
        <a href="${siteUrl}/address/${addressSlug}" style="display:inline-block;padding:12px 32px;background:#1f6feb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Full Report</a>
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
