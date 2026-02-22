import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .single();

  if (existing) {
    if (existing.status === 'active') {
      return NextResponse.json({ message: "You're already subscribed!" });
    }
    // Re-subscribe
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'active', unsubscribed_at: null })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Welcome back! You have been re-subscribed.' });
  }

  // New subscriber
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email });

  if (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ message: "You're subscribed! Look for our weekly update." });
}
