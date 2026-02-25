import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Normalize: uppercase, strip city/state words, collapse spaces, prefix match
  const street = address
    .toUpperCase()
    .split(',')[0]
    .replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const { data, error } = await supabase
    .from('claimed_buildings')
    .select('claimant_role, verification_status, claimed_at, landlord_id')
    .ilike('address', `${street}%`)
    .in('verification_status', ['pending', 'approved'])
    .order('claimed_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Building claim lookup error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ claim: null });
  }

  // Fetch company_name from landlord_profiles
  let companyName: string | null = null;
  const { data: profile } = await supabase
    .from('landlord_profiles')
    .select('company_name, verified')
    .eq('id', data.landlord_id)
    .single();

  if (profile) {
    companyName = profile.company_name;
  }

  return NextResponse.json({
    claim: {
      company_name: companyName,
      claimant_role: data.claimant_role,
      verification_status: data.verification_status,
      claimed_at: data.claimed_at,
      verified: profile?.verified ?? false,
    },
  });
}
