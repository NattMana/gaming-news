import type { Article, ArticleFilters, PageResult } from '@/lib/types';
import { dataSource } from '@/lib/config';
import { mockArticles } from '@/lib/data/mock-articles';
import { getPool } from '@/lib/db';
export interface ArticleProvider {
  list(f: ArticleFilters): Promise<PageResult>;
  filters(): Promise<Record<string, string[]>>;
  get(id: string): Promise<Article | null>;
  setReviewStatus(id: string, status: string): Promise<Article | null>;
}
function test(a: Article, f: ArticleFilters) {
  const q = f.search.trim().toLowerCase();
  return (
    (!q ||
      [a.title, a.ai_title, a.canonical_url, a.raw_url].some((x) =>
        x?.toLowerCase().includes(q),
      )) &&
    (['status', 'mode', 'language', 'region'] as const).every(
      (k) => !f[k] || (f[k] === '__null' ? a[k] === null || a[k] === '' : a[k] === f[k]),
    ) &&
    (!f.do_status ||
      (f.do_status === '__null'
        ? a.do_status === null || a.do_status === ''
        : f.do_status === '__other'
          ? !!a.do_status && !['undone', 'done', 'skip'].includes(a.do_status)
          : a.do_status === f.do_status)) &&
    (!f.dateFrom || (a.pub_date != null && a.pub_date.slice(0, 10) >= f.dateFrom)) &&
    (!f.dateTo || (a.pub_date != null && a.pub_date.slice(0, 10) <= f.dateTo))
  );
}
class MockProvider implements ArticleProvider {
  async list(f: ArticleFilters) {
    const found = mockArticles.filter((a) => test(a, f));
    const key = f.sortBy as keyof Article;
    found.sort((a, b) => {
      const av = a[key],
        bv = b[key];
      const c =
        av == null
          ? bv == null
            ? 0
            : 1
          : bv == null
            ? -1
            : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return (
        (f.sortOrder === 'desc' ? -c : c) ||
        String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
      );
    });
    const total = found.length;
    return {
      items: found.slice((f.page - 1) * f.pageSize, f.page * f.pageSize),
      page: f.page,
      pageSize: f.pageSize,
      total,
      totalPages: Math.ceil(total / f.pageSize),
    };
  }
  async filters() {
    return Object.fromEntries(
      ['status', 'mode', 'language', 'region']
        .map((k) => {
          const vals = mockArticles.map((a) => a[k as keyof Article]);
          return [
            k,
            [
              ...new Set([
                ...vals.filter((x): x is string => typeof x === 'string' && x !== ''),
                ...(vals.some((x) => x == null || x === '') ? ['__null'] : []),
              ]),
            ].sort(),
          ];
        })
        .concat([
          [
            'do_status',
            [
              ...(mockArticles.some((a) => a.do_status == null || a.do_status === '')
                ? ['__null']
                : []),
              ...(mockArticles.some(
                (a) => !!a.do_status && !['undone', 'done', 'skip'].includes(a.do_status),
              )
                ? ['__other']
                : []),
            ],
          ] as [string, string[]],
        ]),
    );
  }
  async get(id: string) {
    return mockArticles.find((a) => String(a.id) === id) ?? null;
  }
  async setReviewStatus(id: string, status: string) {
    const a = mockArticles.find((a) => String(a.id) === id);
    if (!a) return null;
    a.do_status = status;
    return a;
  }
}
class PostgresProvider implements ArticleProvider {
  async list(f: ArticleFilters) {
    const p: unknown[] = [];
    const w: string[] = [];
    const add = (sql: string, v: unknown) => {
      p.push(v);
      w.push(sql.replace('?', `$${p.length}`));
    };
    if (f.search) {
      p.push(`%${f.search}%`);
      const n = p.length;
      w.push(
        `(title ILIKE $${n} OR ai_title ILIKE $${n} OR canonical_url ILIKE $${n} OR raw_url ILIKE $${n})`,
      );
    }
    for (const [key, col] of [
      ['status', 'status'],
      ['do_status', 'do_status'],
      ['mode', 'mode'],
      ['language', 'language'],
      ['region', 'region'],
    ] as const) {
      const v = f[key];
      if (v) {
        if (v === '__null') w.push(`(${col} IS NULL OR ${col} = '')`);
        else if (key === 'do_status' && v === '__other')
          w.push(
            `do_status IS NOT NULL AND do_status <> '' AND do_status NOT IN ('undone','done','skip')`,
          );
        else add(`${col} = ?`, v);
      }
    }
    if (f.dateFrom) add('pub_date >= ?::date', f.dateFrom);
    if (f.dateTo) add("pub_date < (?::date + INTERVAL '1 day')", f.dateTo);
    const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
    const pool = getPool();
    const count = await pool.query(`SELECT COUNT(*) AS n FROM articles ${where}`, p);
    const sort =
      {
        pub_date: 'pub_date',
        id: 'id',
        status: 'status',
        do_status: 'do_status',
        title: 'COALESCE(ai_title,title)',
      }[f.sortBy] || 'pub_date';
    const dir = f.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const offset = (f.page - 1) * f.pageSize;
    const rows = await pool.query(
      `SELECT ${ARTICLE_SQL} FROM articles ${where} ORDER BY ${sort} ${dir} NULLS LAST, id DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, f.pageSize, offset],
    );
    const total = Number(count.rows[0]?.n || 0);
    return {
      items: rows.rows as Article[],
      page: f.page,
      pageSize: f.pageSize,
      total,
      totalPages: Math.ceil(total / f.pageSize),
    };
  }
  async filters() {
    const pool = getPool();
    const entries = await Promise.all(
      (['status', 'mode', 'language', 'region', 'do_status'] as const).map(async (k) => {
        const vals = (
          await pool.query(
            `SELECT DISTINCT ${k} AS v FROM articles WHERE ${k} IS NOT NULL AND ${k} <> '' ORDER BY ${k}`,
          )
        ).rows.map((r) => r.v as string);
        const hasNull = (
          await pool.query(
            `SELECT EXISTS(SELECT 1 FROM articles WHERE ${k} IS NULL OR ${k} = '') AS yes`,
          )
        ).rows[0]?.yes;
        if (k === 'do_status')
          return [
            k,
            [
              ...(hasNull ? ['__null'] : []),
              ...(vals.some((v) => !['undone', 'done', 'skip'].includes(v)) ? ['__other'] : []),
            ],
          ] as const;
        return [k, [...vals, ...(hasNull ? ['__null'] : [])]] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<string, string[]>;
  }
  async get(id: string) {
    const r = await getPool().query(
      `SELECT ${ARTICLE_SQL} FROM articles WHERE id::text=$1 LIMIT 1`,
      [id],
    );
    return r.rows[0] ?? null;
  }
  async setReviewStatus(id: string, status: string) {
    const r = await getPool().query(
      `UPDATE articles SET do_status=$1 WHERE id::text=$2 RETURNING ${ARTICLE_SQL}`,
      [status, id],
    );
    return r.rows[0] ?? null;
  }
}
const ARTICLE_SQL =
  'id,url_hash,canonical_url,title,content,creator,pub_date,fetched_at,status,mode,language,region,raw_url,ai_title,ai_full_summary,ai_short_summary_2_sentences,do_status,preverdict';
let provider: ArticleProvider | undefined;
export function articleProvider(): ArticleProvider {
  if (!provider) provider = dataSource() === 'mock' ? new MockProvider() : new PostgresProvider();
  return provider;
}
