import { NextResponse } from 'next/server';
import { articleProvider } from '@/lib/data/provider';
export async function GET() {
  try {
    return NextResponse.json(await articleProvider().filters(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('article filters failed', e instanceof Error ? e.message : 'unknown error');
    return NextResponse.json({ error: 'Unable to load filter values.' }, { status: 503 });
  }
}
