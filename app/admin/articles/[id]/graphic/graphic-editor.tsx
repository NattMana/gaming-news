'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Article } from '@/lib/types';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const EXPORT_TIMEOUT_MS = 30_000;

type PublishStatus = 'idle' | 'exporting' | 'publishing' | 'success' | 'error';
type PendingExport = { requestId: string; timeout: number };
type GraphicMessage = {
  type?: unknown;
  requestId?: unknown;
  blob?: unknown;
  error?: unknown;
};

export default function GraphicEditor({ article, back }: { article: Article; back: string }) {
  const query = new URLSearchParams({
    articleId: String(article.id),
    headline: article.ai_title ?? article.title ?? '',
    subtitle: article.ai_short_summary_2_sentences ?? '',
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingExport = useRef<PendingExport | null>(null);
  const publishing = useRef(false);
  const [view, setView] = useState<'editor' | 'preview'>('editor');
  const [frameReady, setFrameReady] = useState(false);
  const [png, setPng] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState(article.ai_full_summary ?? '');
  const [restored, setRestored] = useState(false);
  const [missingPreview, setMissingPreview] = useState(false);
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [error, setError] = useState('');
  const [postId, setPostId] = useState('');
  const title = (article.ai_title ?? article.title)?.trim() || 'ข่าวไม่มีหัวข้อ';
  const storageKey = `facebook-publish:${String(article.id)}`;
  const previewKey = `${storageKey}:preview`;
  const captionKey = `${storageKey}:caption`;
  const busy = status === 'exporting' || status === 'publishing';

  useEffect(() => {
    try {
      const savedCaption = sessionStorage.getItem(captionKey);
      if (savedCaption !== null) setCaption(savedCaption);
      if (sessionStorage.getItem(previewKey) === '1') {
        setView('preview');
        setMissingPreview(true);
      }
    } catch {}
    setRestored(true);
  }, [captionKey, previewKey]);

  useEffect(() => {
    if (!restored || status === 'success') return;
    try {
      sessionStorage.setItem(captionKey, caption);
    } catch {}
  }, [caption, captionKey, restored, status]);

  useEffect(() => {
    if (!png) {
      setImageUrl('');
      return;
    }
    const url = URL.createObjectURL(png);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [png]);

  useEffect(() => {
    const receiveExport = (event: MessageEvent<GraphicMessage>) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const message = event.data;
      const pending = pendingExport.current;
      if (!pending || message?.requestId !== pending.requestId) return;
      if (
        message.type !== 'GRAPHIC_PNG_EXPORTED' &&
        message.type !== 'GRAPHIC_PNG_EXPORT_ERROR'
      )
        return;

      window.clearTimeout(pending.timeout);
      pendingExport.current = null;
      if (message.type === 'GRAPHIC_PNG_EXPORT_ERROR') {
        setStatus('error');
        setError(typeof message.error === 'string' ? message.error : 'Export PNG ไม่สำเร็จ');
        return;
      }
      if (!(message.blob instanceof Blob) || message.blob.type !== 'image/png' || !message.blob.size) {
        setStatus('error');
        setError('ได้รับไฟล์ PNG จาก Graphic Editor ไม่ถูกต้อง กรุณาลองอีกครั้ง');
        return;
      }
      setPng(message.blob);
      setMissingPreview(false);
      setView('preview');
      setStatus('idle');
      setError('');
    };

    window.addEventListener('message', receiveExport);
    return () => {
      window.removeEventListener('message', receiveExport);
      if (pendingExport.current) window.clearTimeout(pendingExport.current.timeout);
    };
  }, []);

  function requestLatestPng() {
    const target = iframeRef.current?.contentWindow;
    if (!target || busy || !frameReady) {
      if (!frameReady) setError('Graphic Editor ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่');
      return;
    }
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setError('');
    setStatus('exporting');
    setMissingPreview(false);
    setPng(null);
    setView('editor');
    try {
      sessionStorage.setItem(previewKey, '1');
    } catch {}
    const timeout = window.setTimeout(() => {
      if (pendingExport.current?.requestId !== requestId) return;
      pendingExport.current = null;
      setStatus('error');
      setError('Graphic Editor ไม่ตอบกลับการ export ภายในเวลาที่กำหนด กรุณาลองอีกครั้ง');
    }, EXPORT_TIMEOUT_MS);
    pendingExport.current = { requestId, timeout };
    target.postMessage({ type: 'EXPORT_GRAPHIC_PNG', requestId }, window.location.origin);
  }

  async function confirmPublish() {
    if (busy || publishing.current) return;
    if (!png) {
      setError('ไฟล์พรีวิวหมดอายุแล้ว กรุณากลับไปที่ Graphic Editor แล้วกด Publish to Facebook เพื่อ export รูปใหม่');
      setStatus('error');
      return;
    }
    if (!caption.trim()) {
      setError('กรุณาใส่ข้อความ caption ก่อนเผยแพร่');
      setStatus('error');
      return;
    }

    setStatus('publishing');
    publishing.current = true;
    setError('');
    setPostId('');
    const form = new FormData();
    form.set('articleId', String(article.id));
    form.set('image', png, 'gaming-news.png');
    form.set('caption', caption);
    try {
      const response = await fetch(`${BASE_PATH}/api/facebook/publish`, {
        method: 'POST',
        body: form,
        cache: 'no-store',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || typeof result.postId !== 'string') {
        const diagnostics = [
          result?.stage ? `ขั้นตอน: ${result.stage}` : '',
          result?.photoId ? `Photo ID: ${result.photoId}` : '',
          result?.facebookError?.code != null ? `Facebook code: ${result.facebookError.code}` : '',
          result?.facebookError?.error_subcode != null
            ? `subcode: ${result.facebookError.error_subcode}`
            : '',
        ].filter(Boolean);
        const message = result?.error || `เผยแพร่ไม่สำเร็จ (HTTP ${response.status})`;
        throw new Error(`${message}${diagnostics.length ? ` · ${diagnostics.join(' · ')}` : ''}`);
      }
      setStatus('success');
      setPostId(result.postId);
      try {
        sessionStorage.removeItem(previewKey);
        sessionStorage.removeItem(captionKey);
      } catch {}
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดขณะเผยแพร่ไปยัง Facebook');
    } finally {
      publishing.current = false;
    }
  }

  function backToEditor() {
    if (busy) return;
    setError('');
    setStatus('idle');
    setMissingPreview(false);
    setView('editor');
  }

  return (
    <>
      <main className={`graphic-page ${view === 'preview' ? 'graphic-page-hidden' : ''}`}>
        <div className="graphic-toolbar">
          <Link className="graphic-back" href={back}>
            ← กลับรายการข่าว
          </Link>
          <span className="graphic-news-title">{title}</span>
          <button className="fb-publish-trigger" type="button" onClick={requestLatestPng} disabled={busy || !frameReady}>
            {status === 'exporting' ? 'กำลังเตรียมรูป…' : 'Publish to Facebook'}
          </button>
          <span className="graphic-source">ตัวแก้ไขจาก Gaming News Studio</span>
        </div>
        <iframe
          ref={iframeRef}
          className="graphic-frame"
          title="Gaming news graphic editor"
          src={`${BASE_PATH}/fb/index.html?${query.toString()}`}
          onLoad={() => setFrameReady(true)}
        />
        {status === 'error' && view === 'editor' && <div className="fb-editor-error">{error}</div>}
      </main>

      {view === 'preview' && (
        <main className="fb-publish-page">
          <header className="fb-publish-header">
            <Link href={back} className="fb-preview-back-link">
              ← กลับรายการข่าว
            </Link>
            <div>
              <div className="fb-preview-eyebrow">FACEBOOK · PREVIEW &amp; EDIT</div>
              <h1>{title}</h1>
              <p>ตรวจสอบภาพและแก้ไขข้อความก่อนยืนยันเผยแพร่</p>
            </div>
          </header>
          <div className="fb-preview-grid">
            <section className="fb-preview-card fb-image-card">
              <div className="fb-card-heading">
                <h2>Image Preview</h2>
                <span>PNG · 940 × 788</span>
              </div>
              <div className="fb-image-stage">
                {imageUrl ? (
                  // The object URL points to the actual exported PNG Blob.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="ตัวอย่างรูปที่จะเผยแพร่บน Facebook" />
                ) : (
                  <div className="fb-image-missing">
                    {missingPreview
                      ? 'ไฟล์ภาพพรีวิวหายหลังจากรีเฟรช กรุณากลับไปที่ Graphic Editor แล้ว export รูปใหม่'
                      : 'ยังไม่มีไฟล์ภาพ กรุณากลับไป export จาก Graphic Editor'}
                  </div>
                )}
              </div>
              <button className="fb-secondary-button" type="button" onClick={backToEditor} disabled={busy}>
                ← Back to Graphic Editor
              </button>
            </section>

            <section className="fb-preview-card fb-caption-card">
              <div className="fb-card-heading">
                <h2>Caption</h2>
                <span>{caption.length.toLocaleString()} characters</span>
              </div>
              <div className="fb-post-preview">
                <div className="fb-post-author"><span>หมาใหญ่ หมีข่าว</span><small>Facebook Page</small></div>
                <p>{caption || 'พิมพ์ caption ที่ต้องการเผยแพร่'}</p>
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="ภาพในตัวอย่างโพสต์" />
                )}
              </div>
              <label className="fb-caption-label" htmlFor="fb-caption">แก้ไขข้อความโพสต์</label>
              <textarea
                id="fb-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={12}
                placeholder="ใส่ข้อความที่ต้องการเผยแพร่"
                disabled={busy || status === 'success'}
              />
              {error && <div className="fb-publish-error" role="alert">{error}</div>}
              {status === 'success' && (
                <div className="fb-publish-success" role="status">
                  เผยแพร่โพสต์ไปยัง Facebook Page สำเร็จ{postId ? ` · Post ID: ${postId}` : ''}
                </div>
              )}
              <button
                className="fb-confirm-button"
                type="button"
                onClick={confirmPublish}
                disabled={busy || status === 'success' || !png}
              >
                {status === 'publishing'
                  ? 'Publishing to Facebook…'
                  : status === 'success'
                    ? 'Published'
                    : 'Confirm & Publish'}
              </button>
              <small className="fb-caption-note">caption ที่แก้ไขจะใช้กับโพสต์นี้เท่านั้น ไม่แก้ข้อมูลต้นฉบับในฐานข้อมูล</small>
            </section>
          </div>
        </main>
      )}
    </>
  );
}
