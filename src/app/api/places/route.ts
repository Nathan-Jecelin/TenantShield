import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ address: null });
  }

  const query = req.nextUrl.searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ address: null }, { status: 400 });
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.formattedAddress',
      },
      body: JSON.stringify({
        textQuery: query + ' Chicago',
        locationBias: {
          circle: {
            center: { latitude: 41.8781, longitude: -87.6298 },
            radius: 25000,
          },
        },
        maxResultCount: 1,
      }),
    });

    if (!res.ok) {
      console.error('Google Places API error:', res.status);
      return NextResponse.json({ address: null });
    }

    const data = await res.json();
    const address = data.places?.[0]?.formattedAddress ?? null;
    return NextResponse.json({ address });
  } catch (err) {
    console.error('Google Places fetch error:', err);
    return NextResponse.json({ address: null });
  }
}
