import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { articleProvider } from '@/lib/data/provider';
import type { ArticleFilters } from '@/lib/types';
const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 25, 50, 100].includes(n))
    .default(25),
  search: z.string().max(200).default(''),
  status: z.string().max(100).default(''),
  do_status: z.string().max(100).default(''),
  mode: z.string().max(100).default(''),
  language: z.string().max(100).default(''),
  region: z.string().max(100).default(''),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(''))
    .default(''),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(''))
    .default(''),
  sortBy: z.enum(['pub_date', 'id', 'status', 'do_status', 'title']).default('pub_date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export async function GET(req: NextRequest) {
  try {
    const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success)
      return NextResponse.json({ error: 'Invalid query parameters.' }, { status: 400 });
    const f = parsed.data as ArticleFilters;
    if (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo)
      return NextResponse.json({ error: 'dateFrom must not be after dateTo.' }, { status: 400 });
    return NextResponse.json(await articleProvider().list(f), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('articles list failed', e instanceof Error ? e.message : 'unknown error');
    return NextResponse.json(
      { error: 'Unable to load articles. Check the database configuration and connection.' },
      { status: 503 },
    );
  }
}
