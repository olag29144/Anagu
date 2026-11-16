import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const globalKey = (globalThis as unknown as { GOOGLE_MAPS_API_KEY?: string })
    .GOOGLE_MAPS_API_KEY;
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    globalKey ||
    '';

  return NextResponse.json(
    {
      apiKey,
      configured: Boolean(apiKey),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
