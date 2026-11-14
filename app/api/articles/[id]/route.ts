import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { articleProvider } from '@/lib/data/provider';
import { REVIEW_STATUSES } from '@/lib/types';
const idSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w.-]+$/);
const bodySchema = z.object({ do_status: z.enum(REVIEW_STATUSES) }).strict();
function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
function expectedRequestOrigin(req: NextRequest) {
  const configured = normalizeOrigin(process.env.APP_ORIGIN);
  if (configured) return configured;

  // Behind a reverse proxy, Next's internal request URL can use http://container:port.
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const host = forwardedHost || req.headers.get('host');
  const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '');
  return normalizeOrigin(host ? `${protocol}://${host}` : req.nextUrl.origin);
}
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success)
    return NextResponse.json({ error: 'Invalid article id.' }, { status: 400 });
  try {
    const article = await articleProvider().get(id);
    return article
      ? NextResponse.json(article, { headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.json({ error: 'Article not found.' }, { status: 404 });
  } catch (e) {
    console.error('article detail failed', e instanceof Error ? e.message : 'unknown error');
    return NextResponse.json({ error: 'Unable to load this article.' }, { status: 503 });
  }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success)
    return NextResponse.json({ error: 'Invalid article id.' }, { status: 400 });
  const origin = req.headers.get('origin');
  if (origin && normalizeOrigin(origin) !== expectedRequestOrigin(req))
    return NextResponse.json({ error: 'Origin check failed.' }, { status: 403 });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success)
    return NextResponse.json(
      { error: 'do_status must be undone, done, or skip.' },
      { status: 400 },
    );
  try {
    const article = await articleProvider().setReviewStatus(id, body.data.do_status);
    return article
      ? NextResponse.json(article, { headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.json({ error: 'Article not found.' }, { status: 404 });
  } catch (e) {
    console.error('article status update failed', e instanceof Error ? e.message : 'unknown error');
    return NextResponse.json({ error: 'Unable to save review status.' }, { status: 503 });
  }
}
