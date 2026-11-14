'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Article, PageResult } from '@/lib/types';
type Filters = {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  do_status: string;
  type: string;
  language: string;
  region: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};
const initial: Filters = {
  page: 1,
  pageSize: 25,
  search: '',
  status: '',
  do_status: '',
  type: '',
  language: '',
  region: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'pub_date',
  sortOrder: 'desc',
};
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const API_BASE = BASE_PATH;
const FRESHNESS = {
  justNowMs: 60_000,
  veryRecentMs: 3_600_000,
  recentMs: 86_400_000,
  weekMs: 604_800_000,
  futureToleranceMs: 60_000,
};
function Freshness({ value, now, zone }: { value: string | null; now: number; zone: string }) {
  if (!value)
    return (
      <span className="fresh fresh-unknown">
        <i className="fresh-dot" />
        Unknown
      </span>
    );
  const time = new Date(value).getTime();
  if (!Number.isFinite(time))
    return (
      <span className="fresh fresh-unknown">
        <i className="fresh-dot" />
        Unknown
      </span>
    );
  const diff = time - now;
  if (diff > FRESHNESS.futureToleranceMs)
    return (
      <span
        className="fresh fresh-future"
        title={new Date(time).toLocaleString(undefined, { timeZone: zone })}
      >
        <i className="fresh-dot" />
        Scheduled
      </span>
    );
  const age = Math.max(0, -diff);
  const label =
    age < FRESHNESS.justNowMs
      ? 'Just now'
      : age < FRESHNESS.veryRecentMs
        ? `${Math.floor(age / 60_000)} min ago`
        : age < FRESHNESS.recentMs
          ? `${Math.floor(age / 3_600_000)} hr ago`
          : age < FRESHNESS.weekMs
            ? `${Math.floor(age / 86_400_000)} day ago`
            : `${Math.floor(age / FRESHNESS.weekMs)} wk ago`;
  const cls =
    age < FRESHNESS.veryRecentMs
      ? 'fresh-very'
      : age < FRESHNESS.recentMs
        ? 'fresh-recent'
        : 'fresh-old';
  return (
    <span
      className={`fresh ${cls}`}
      title={new Date(time).toLocaleString(undefined, { timeZone: zone })}
    >
      <i className="fresh-dot" />
      {label}
    </span>
  );
}
function Review({
  article,
  onSaved,
}: {
  article: Article;
  onSaved: (id: string, status: string) => void;
}) {
  const [val, setVal] = useState(
    article.do_status === 'done' || article.do_status === 'skip' ? article.do_status : 'undone',
  );
  const [busy, setBusy] = useState(false);
  return (
    <select
      className="review-select"
      aria-label={`Review status for article ${article.id}`}
      value={val}
      disabled={busy}
      onChange={async (e) => {
        const next = e.target.value,
          old = val;
        setVal(next);
        setBusy(true);
        try {
          const r = await fetch(`${API_BASE}/api/articles/${encodeURIComponent(String(article.id))}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ do_status: next }),
          });
          if (!r.ok) throw new Error((await r.json()).error || 'Unable to save.');
          onSaved(String(article.id), next);
        } catch (err) {
          setVal(old);
          window.dispatchEvent(
            new CustomEvent('toast', {
              detail: err instanceof Error ? err.message : 'Unable to save status.',
            }),
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <option value="undone">Undone</option>
      <option value="done">Done</option>
      <option value="skip">Skip</option>
    </select>
  );
}
function qs(f: Filters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f))
    if ((v !== '' && v !== 1 && k !== 'page') || (k === 'page' && v !== 1)) p.set(k, String(v));
  return p.toString();
}
function graphicHref(a: Article, f: Filters) {
  const query = qs(f),
    back = `/admin/articles${query ? `?${query}` : ''}`;
  return `/admin/articles/${encodeURIComponent(String(a.id))}/graphic?back=${encodeURIComponent(back)}`;
}
export default function ArticlesPage() {
  const [filters, setFilters] = useState<Filters>(initial);
  const [data, setData] = useState<PageResult | null>(null);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(0);
  const [zone, setZone] = useState('Asia/Bangkok');
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setFilters((v) => ({
      ...v,
      page: Number(p.get('page')) || 1,
      pageSize: [10, 25, 50, 100].includes(Number(p.get('pageSize')))
        ? Number(p.get('pageSize'))
        : 25,
      search: p.get('search') || '',
      status: p.get('status') || '',
      do_status: p.get('do_status') || '',
      type: p.get('type') || '',
      language: p.get('language') || '',
      region: p.get('region') || '',
      dateFrom: p.get('dateFrom') || '',
      dateTo: p.get('dateTo') || '',
      sortBy: p.get('sortBy') || 'pub_date',
      sortOrder: p.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    }));
    setNow(Date.now());
    fetch(`${API_BASE}/api/config`)
      .then((r) => r.json())
      .then((c) => {
        if (c.timeZone) setZone(c.timeZone);
      })
      .catch(() => { });
    const t = window.setInterval(() => setNow(Date.now()), 60000);
    const listen = (e: Event) => {
      setToast((e as CustomEvent).detail);
      window.setTimeout(() => setToast(''), 3200);
    };
    window.addEventListener('toast', listen);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('toast', listen);
    };
  }, []);
  const load = useCallback(async (f: Filters) => {
    try {
      setError('');
      const r = await fetch(`${API_BASE}/api/articles?${qs(f)}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load articles.');
      setData(j);
      const u = new URL(location.href);
      u.search =
        j.page === 1 &&
          j.pageSize === 25 &&
          !f.search &&
          !f.status &&
          !f.do_status &&
          !f.type &&
          !f.language &&
          !f.region &&
          !f.dateFrom &&
          !f.dateTo &&
          f.sortBy === 'pub_date' &&
          f.sortOrder === 'desc'
          ? ''
          : `?${qs(f)}`;
      history.replaceState(null, '', u.toString());
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Unable to load articles.');
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => load(filters), 220);
    return () => window.clearTimeout(t);
  }, [filters, load]);
  useEffect(() => {
    fetch(`${API_BASE}/api/articles/filters`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setOptions(await r.json());
      })
      .catch(() => setError('Unable to load database filter values.'));
  }, []);
  const patch = (k: keyof Filters, v: string | number) =>
    setFilters((x) => ({ ...x, [k]: v, page: 1 }));
  const sort = (key: string) =>
    setFilters((x) => ({
      ...x,
      sortBy: key,
      sortOrder: x.sortBy === key && x.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  const selected = useMemo(() => data?.items.length || 0, [data]);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span className="brand-name">Newsroom</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active">
          <span className="nav-icon">▤</span>
          <span className="nav-text">Articles</span>
        </div>
        <div className="sidebar-foot">
          GAMING NEWS
          <br />
          EDITORIAL DESK
        </div>
      </aside>
      <main className="main">
        <div className="topline">
          <div className="crumb">Workspace&nbsp; / &nbsp;Articles</div>
          <div className="user-chip">
            <span className="avatar">N</span> News editor
          </div>
        </div>
        <div className="heading-row">
          <div>
            <div className="eyebrow">CONTENT MANAGEMENT</div>
            <h1 className="heading">Articles</h1>
            <p className="subheading">Review and manage your gaming news feed.</p>
          </div>
          <div className="live-tag">
            <i className="live-dot" />
            Live database
          </div>
        </div>
        <section className="toolbar">
          <div className="toolbar-top">
            <div className="search-wrap">
              <span className="search-symbol">⌕</span>
              <input
                className="search"
                placeholder="Search titles or URLs..."
                value={filters.search}
                onChange={(e) => patch('search', e.target.value)}
              />
            </div>
            {(
              [
                ['status', 'Status'],
                ['do_status', 'Review'],
                ['type', 'Type'],
                ['language', 'Language'],
                ['region', 'Region'],
              ] as const
            ).map(([key, label]) => (
              <select
                className="select"
                key={key}
                value={filters[key]}
                onChange={(e) => patch(key, e.target.value)}
              >
                <option value="">{label}: All</option>
                {key === 'do_status' ? (
                  <>
                    <option value="undone">Undone</option>
                    <option value="done">Done</option>
                    <option value="skip">Skip</option>
                    {options.do_status?.includes('__null') && (
                      <option value="__null">Missing</option>
                    )}
                    {options.do_status?.includes('__other') && (
                      <option value="__other">Other value</option>
                    )}
                  </>
                ) : (
                  <>
                    {options[key]?.map((v) => (
                      <option key={v} value={v}>
                        {v === '__null' ? 'Missing' : v}
                      </option>
                    ))}
                  </>
                )}
              </select>
            ))}
            <div className="date-wrap">
              <input
                aria-label="Publication date from"
                className="field date"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => patch('dateFrom', e.target.value)}
              />
              <span>–</span>
              <input
                aria-label="Publication date to"
                className="field date"
                type="date"
                value={filters.dateTo}
                onChange={(e) => patch('dateTo', e.target.value)}
              />
            </div>
          </div>
          <div className="toolbar-bottom">
            <span>Filters apply to publication date</span>
            <button className="clear-btn" onClick={() => setFilters(initial)}>
              Reset filters
            </button>
          </div>
        </section>
        <section className="panel">
          {error ? (
            <div className="error">{error}</div>
          ) : !data ? (
            <div className="empty">
              <span className="spinner" /> &nbsp;Loading articles…
            </div>
          ) : selected === 0 ? (
            <div className="empty">No articles match these filters.</div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>
                        <button onClick={() => sort('id')}>
                          ID{' '}
                          {filters.sortBy === 'id' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                      <th>
                        <button onClick={() => sort('title')}>
                          Article{' '}
                          {filters.sortBy === 'title'
                            ? filters.sortOrder === 'asc'
                              ? '↑'
                              : '↓'
                            : ''}
                        </button>
                      </th>
                      <th>
                        <button onClick={() => sort('pub_date')}>
                          Published{' '}
                          {filters.sortBy === 'pub_date'
                            ? filters.sortOrder === 'asc'
                              ? '↑'
                              : '↓'
                            : ''}
                        </button>
                      </th>
                      <th>Freshness</th>
                      <th>
                        <button onClick={() => sort('status')}>
                          Pipeline status{' '}
                          {filters.sortBy === 'status'
                            ? filters.sortOrder === 'asc'
                              ? '↑'
                              : '↓'
                            : ''}
                        </button>
                      </th>
                      <th>Review status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((a) => (
                      <tr key={String(a.id)}>
                        <td className="id">{String(a.id)}</td>
                        <td>
                          <Link className="article-link" href={graphicHref(a, filters)}>
                            {(a.ai_title ?? a.title)?.trim() || 'Untitled article'}
                          </Link>
                          <div className="article-sub">{a.creator || 'Unknown source'}</div>
                        </td>
                        <td className="id">
                          {a.pub_date && Number.isFinite(new Date(a.pub_date).getTime())
                            ? new Date(a.pub_date).toLocaleString(undefined, { timeZone: zone })
                            : '—'}
                        </td>
                        <td>
                          {now ? (
                            <Freshness value={a.pub_date} now={now} zone={zone} />
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td>
                          <span className="badge">{a.status || 'Unknown'}</span>
                        </td>
                        <td>
                          <Review
                            article={a}
                            onSaved={(_, v) => setToast(`Review status saved: ${v}`)}
                          />
                        </td>
                        <td>
                          <Link
                            href={`/admin/articles/${encodeURIComponent(String(a.id))}?${qs(filters)}`}
                            className="clear-btn"
                          >
                            View&nbsp; ↗
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  {data.total.toLocaleString()} matching articles&nbsp; · &nbsp;Page {data.page} of{' '}
                  {Math.max(1, data.totalPages)}
                </span>
                <div className="page-actions">
                  <select
                    className="select"
                    aria-label="Page size"
                    value={filters.pageSize}
                    onChange={(e) => patch('pageSize', Number(e.target.value))}
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    className="page-btn"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters((x) => ({ ...x, page: x.page - 1 }))}
                  >
                    ← Previous
                  </button>
                  <button
                    className="page-btn"
                    disabled={filters.page >= data.totalPages}
                    onClick={() => setFilters((x) => ({ ...x, page: x.page + 1 }))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        <div className="footer-note">
          Publication freshness updates every minute. Exact publication time appears on hover.
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
