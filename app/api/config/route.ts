import { NextResponse } from 'next/server';
import { timeZone } from '@/lib/config';
export async function GET() {
  return NextResponse.json({ timeZone: timeZone() }, { headers: { 'Cache-Control': 'no-store' } });
}
