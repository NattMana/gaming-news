import { notFound } from 'next/navigation';
import { articleProvider } from '@/lib/data/provider';
import type { Article } from '@/lib/types';
import GraphicEditor from './graphic-editor';

export const dynamic = 'force-dynamic';
export default async function GraphicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const [{ id }, { back: requestedBack }] = await Promise.all([params, searchParams]);
  let article: Article | null;
  try {
    article = await articleProvider().get(id);
  } catch (e) {
    console.error(
      'graphic article lookup failed',
      e instanceof Error ? e.message : 'unknown error',
    );
    return (
      <main className="graphic-error">
        ไม่สามารถโหลดข่าวได้ กรุณาตรวจสอบการเชื่อมต่อข้อมูลแล้วลองอีกครั้ง
      </main>
    );
  }
  if (!article) notFound();
  const back =
    requestedBack?.startsWith('/admin/articles') && !requestedBack.startsWith('//')
      ? requestedBack
      : '/admin/articles';
  return <GraphicEditor article={article} back={back} />;
}
