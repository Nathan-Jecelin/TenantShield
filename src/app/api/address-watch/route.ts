import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import {
  fetchBuildingViolations,
  fetchServiceRequests,
  parseStreetAddress,
  generateAddressVariants,
} from '@/lib/chicagoData';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: { email?: string; address?: string; userId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Address is required.' }, { status: 400 });
  }

  const userId = body.userId || null;

  // Check if already watching this address
  const { data: existing, error: lookupError } = await supabase
    .from('address_watch')
    .select('id, active')
    .eq('email', email)
    .eq('address', address)
    .maybeSingle();

  if (lookupError) {
    console.error('Address watch lookup error:', lookupError);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  if (existing) {
    if (existing.active) {
      return NextResponse.json({ message: "You're already watching this address!" });
    }
    // Re-activate
    const { error } = await supabase
      .from('address_watch')
      .update({ active: true, user_id: userId })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Address watch re-activated!' });
  }

  // New watch
  const { data: inserted, error } = await supabase
    .from('address_watch')
    .insert({ email, address, user_id: userId })
    .select('id')
    .single();

  if (error) {
    console.error('Address watch insert error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  // Store baseline counts so we only alert on *new* records
  try {
    const parsed = parseStreetAddress(address);
    const variants = generateAddressVariants(parsed);
    const [violations, complaints] = await Promise.all([
      fetchBuildingViolations(variants),
      fetchServiceRequests(variants),
    ]);
    await supabase
      .from('address_watch')
      .update({
        last_violation_count: violations.length,
        last_complaint_count: complaints.length,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', inserted.id);
  } catch (err) {
    console.error('Failed to store baseline counts:', err);
    // Non-fatal — the watch is still created, counts default to 0
  }

  return NextResponse.json({ message: "You'll be notified if new records appear for this address." });
}
