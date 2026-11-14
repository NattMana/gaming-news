'use client';
import Link from 'next/link';
import type { Article } from '@/lib/types';

export default function GraphicEditor({ article, back }: { article: Article; back: string }) {
  const query = new URLSearchParams({
    articleId: String(article.id),
    headline: article.ai_title ?? article.title ?? '',
    subtitle: article.ai_short_summary_2_sentences ?? '',
  });
  return (
    <main className="graphic-page">
      <div className="graphic-toolbar">
        <Link className="graphic-back" href={back}>
          ← กลับรายการข่าว
        </Link>
        <span className="graphic-news-title">
          {(article.ai_title ?? article.title)?.trim() || 'ข่าวไม่มีหัวข้อ'}
        </span>
        <span className="graphic-source">ตัวแก้ไขจาก Gaming News Studio</span>
      </div>
      <iframe
        className="graphic-frame"
        title="Gaming news graphic editor"
        src={`/news/fb/index.html?${query.toString()}`}
      />
    </main>
  );
}
