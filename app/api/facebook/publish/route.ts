import { NextRequest, NextResponse } from 'next/server';
import { articleProvider } from '@/lib/data/provider';
import type { Article } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function normalizedOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function requestOrigin(req: NextRequest) {
  const configured = normalizedOrigin(process.env.APP_ORIGIN);
  if (configured) return configured;
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const host = forwardedHost || req.headers.get('host');
  const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '');
  return normalizedOrigin(host ? `${protocol}://${host}` : req.nextUrl.origin);
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && normalizedOrigin(origin) !== requestOrigin(req))
    return errorResponse('Origin check failed.', 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse('Invalid multipart upload.', 400);
  }

  const articleId = form.get('articleId');
  const caption = form.get('caption');
  const image = form.get('image');
  if (typeof articleId !== 'string' || !/^[\w.-]{1,200}$/.test(articleId))
    return errorResponse('A valid articleId is required.', 400);
  if (typeof caption !== 'string' || !caption.trim())
    return errorResponse('Caption cannot be empty.', 400);
  if (caption.length > 63_000) return errorResponse('Caption is too long.', 400);
  if (!(image instanceof File)) return errorResponse('A PNG image file is required.', 400);
  if (image.type !== 'image/png') return errorResponse('The uploaded image must be a PNG.', 400);
  if (!image.size || image.size > MAX_IMAGE_BYTES)
    return errorResponse('The PNG must be smaller than 10 MB.', 413);

  let article: Article | null;
  try {
    article = await articleProvider().get(articleId);
  } catch (e) {
    console.error('Facebook publish article lookup failed', e instanceof Error ? e.message : 'unknown error');
    return errorResponse('Unable to validate the article. Check the database connection.', 503);
  }
  if (!article) return errorResponse('Article not found.', 404);

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!appId || !appSecret || !pageId || !/^\d+$/.test(pageId) || !accessToken)
    return errorResponse('Facebook Page publishing is not configured on the server.', 503);
  const version = process.env.FACEBOOK_GRAPH_API_VERSION || 'v27.0';
  if (!/^v\d+\.\d+$/.test(version))
    return errorResponse('Facebook Graph API version is not configured correctly.', 503);

  try {
    const imageBuffer = await image.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value))
      return errorResponse('The uploaded file is not a valid PNG image.', 400);

    const upload = new FormData();
    upload.set('source', new Blob([imageBuffer], { type: 'image/png' }), 'gaming-news.png');
    upload.set('caption', caption);
    upload.set('access_token', accessToken);

    const response = await fetch(
      `https://graph.facebook.com/${version}/${pageId}/photos`,
      { method: 'POST', body: upload, cache: 'no-store' },
    );
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.error) {
      const message =
        typeof result?.error?.message === 'string'
          ? result.error.message.replaceAll(accessToken, '[redacted]').slice(0, 500)
          : 'Facebook rejected the photo upload.';
      return errorResponse(`Facebook publish failed: ${message}`, 502);
    }
    if (typeof result?.id !== 'string')
      return errorResponse('Facebook did not confirm the photo upload.', 502);

    return NextResponse.json({
      success: true,
      photoId: result.id,
      postId: typeof result.post_id === 'string' ? result.post_id : null,
    });
  } catch (e) {
    console.error('Facebook photo upload failed', e instanceof Error ? e.message : 'unknown error');
    return errorResponse('Unable to reach Facebook to publish this post.', 502);
  }
}
