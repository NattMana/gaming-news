'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Article } from '@/lib/types';
const fields: [keyof Article, string][] = [
  ['id', 'ID'],
  ['url_hash', 'URL hash'],
  ['canonical_url', 'Canonical URL'],
  ['title', 'Original title'],
  ['content', 'Original content'],
  ['creator', 'Creator'],
  ['pub_date', 'Publication date'],
  ['fetched_at', 'Fetched at'],
  ['status', 'Pipeline status'],
  ['type', 'Type'],
  ['language', 'Language'],
  ['region', 'Region'],
  ['raw_url', 'Original URL'],
  ['ai_title', 'AI title'],
  ['ai_full_summary', 'AI full summary'],
  ['ai_short_summary_2_sentences', 'AI short summary (2 sentences)'],
  ['preverdict', 'Pre-verdict'],
  ['do_status', 'Review status'],
];
function Value({ field, value, zone }: { field: keyof Article; value: unknown; zone: string }) {
  if (value == null || value === '') return <span style={{ color: '#9aa69f' }}>—</span>;
  if ((field === 'canonical_url' || field === 'raw_url') && typeof value === 'string') {
    try {
      const u = new URL(value);
      if (u.protocol === 'http:' || u.protocol === 'https:')
        return (
          <a href={u.toString()} target="_blank" rel="noopener noreferrer">
            {value} ↗
          </a>
        );
    } catch {}
  }
  if ((field === 'pub_date' || field === 'fetched_at') && typeof value === 'string') {
    const d = new Date(value);
    if (Number.isFinite(d.getTime()))
      return <span title={d.toISOString()}>{d.toLocaleString(undefined, { timeZone: zone })}</span>;
  }
  if (typeof value === 'object')
    return (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  return <>{String(value)}</>;
}
export default function ArticleDetail({
  article: initialArticle,
  error: initialError,
  id,
}: {
  article: Article | null;
  error: string;
  id: string;
}) {
  const search = useSearchParams();
  const [article, setArticle] = useState<Article | null>(initialArticle),
    [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(''),
    [zone, setZone] = useState('Asia/Bangkok');
  const back = search.toString() ? `/admin/articles?${search.toString()}` : '/admin/articles';
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => {
        if (c.timeZone) setZone(c.timeZone);
      })
      .catch(() => {});
  }, []);
  async function update(v: string) {
    if (!article) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ do_status: v }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to save status.');
      setArticle(j);
      setToast('Review status saved.');
      window.setTimeout(() => setToast(''), 2800);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Unable to save.');
      window.setTimeout(() => setToast(''), 3500);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span className="brand-name">Newsroom</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <Link className="nav-item active" href="/admin/articles">
          <span className="nav-icon">▤</span>
          <span className="nav-text">Articles</span>
        </Link>
        <div className="sidebar-foot">
          GAMING NEWS
          <br />
          EDITORIAL DESK
        </div>
      </aside>
      <main className="main">
        <div className="topline">
          <div className="crumb">
            Workspace&nbsp; / &nbsp;<Link href={back}>Articles</Link>&nbsp; / &nbsp;Detail
          </div>
          <div className="user-chip">
            <span className="avatar">N</span> News editor
          </div>
        </div>
        <Link href={back} className="back-link">
          ← Back to articles
        </Link>
        {error ? (
          <div className="panel error">
            {error === 'Article not found.' ? 'Article not found.' : error}
          </div>
        ) : !article ? (
          <div className="empty">
            <span className="spinner" /> &nbsp;Loading article…
          </div>
        ) : (
          <>
            <div className="heading-row">
              <div>
                <div className="eyebrow">ARTICLE DETAIL · ID {String(article.id)}</div>
                <h1 className="heading">
                  {(article.ai_title ?? article.title)?.trim() || 'Untitled article'}
                </h1>
                <p className="subheading">Review the article content and processing details.</p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#819089', marginRight: 9 }}>
                  Review status
                </span>
                <select
                  className="review-select"
                  value={
                    article.do_status === 'done' || article.do_status === 'skip'
                      ? article.do_status
                      : 'undone'
                  }
                  disabled={busy}
                  onChange={(e) => update(e.target.value)}
                >
                  <option value="undone">Undone</option>
                  <option value="done">Done</option>
                  <option value="skip">Skip</option>
                </select>
              </div>
            </div>
            <div className="detail-grid">
              {fields.map(([key, label]) => (
                <section key={key} className="detail-card">
                  <div className="kv-label">{label}</div>
                  <div className="kv-value">
                    <Value field={key} value={article[key]} zone={zone} />
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
