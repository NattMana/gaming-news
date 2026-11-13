import { notFound } from 'next/navigation';
import ArticleDetail from './detail-client';
import { articleProvider } from '@/lib/data/provider';
import type { Article } from '@/lib/types';

export const dynamic = 'force-dynamic';
export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let article: Article | null;
  try {
    article = await articleProvider().get(id);
  } catch (e) {
    console.error('article page failed', e instanceof Error ? e.message : 'unknown error');
    return (
      <ArticleDetail
        article={null}
        error="Unable to load this article. Check the database connection."
        id={id}
      />
    );
  }
  if (!article) notFound();
  return <ArticleDetail article={article} error="" id={id} />;
}
