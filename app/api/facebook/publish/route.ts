
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

  const forwardedHost = req.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    .trim();

  const forwardedProto = req.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    .trim();

  const host = forwardedHost || req.headers.get('host');
  const protocol =
    forwardedProto || req.nextUrl.protocol.replace(':', '');

  return normalizedOrigin(
    host ? `${protocol}://${host}` : req.nextUrl.origin,
  );
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

function safeFacebookError(
  error: unknown,
  accessToken: string,
) {
  if (!error || typeof error !== 'object') return null;

  const details = error as Record<string, unknown>;

  return {
    message:
      typeof details.message === 'string'
        ? details.message
          .replaceAll(accessToken, '[redacted]')
          .slice(0, 500)
        : undefined,

    type:
      typeof details.type === 'string'
        ? details.type
        : undefined,

    code:
      typeof details.code === 'number' ||
        typeof details.code === 'string'
        ? details.code
        : undefined,

    error_subcode:
      typeof details.error_subcode === 'number' ||
        typeof details.error_subcode === 'string'
        ? details.error_subcode
        : undefined,
  };
}

export async function POST(req: NextRequest) {
  // 1. Validate Origin
  const origin = req.headers.get('origin');

  if (
    origin &&
    normalizedOrigin(origin) !== requestOrigin(req)
  ) {
    return errorResponse('Origin check failed.', 403);
  }

  // 2. Parse multipart form
  let form: FormData;

  try {
    form = await req.formData();
  } catch {
    return errorResponse('Invalid multipart upload.', 400);
  }

  const articleId = form.get('articleId');
  const caption = form.get('caption');
  const image = form.get('image');

  // 3. Validate article ID
  if (
    typeof articleId !== 'string' ||
    !/^[\w.-]{1,200}$/.test(articleId)
  ) {
    return errorResponse('A valid articleId is required.', 400);
  }

  // 4. Validate caption
  if (typeof caption !== 'string' || !caption.trim()) {
    return errorResponse('Caption cannot be empty.', 400);
  }

  if (caption.length > 63_000) {
    return errorResponse('Caption is too long.', 400);
  }

  // 5. Validate image
  if (!(image instanceof File)) {
    return errorResponse('A PNG image file is required.', 400);
  }

  if (image.type !== 'image/png') {
    return errorResponse(
      'The uploaded image must be a PNG.',
      400,
    );
  }

  if (!image.size || image.size > MAX_IMAGE_BYTES) {
    return errorResponse(
      'The PNG must be smaller than 10 MB.',
      413,
    );
  }

  // 6. Validate article exists
  let article: Article | null;

  try {
    article = await articleProvider().get(articleId);
  } catch (e) {
    console.error(
      '[Facebook Publish] Article lookup failed',
      e instanceof Error ? e.message : 'unknown error',
    );

    return errorResponse(
      'Unable to validate the article. Check the database connection.',
      503,
    );
  }

  if (!article) {
    return errorResponse('Article not found.', 404);
  }

  // 7. Facebook configuration
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken =
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  const version =
    process.env.FACEBOOK_GRAPH_API_VERSION || 'v27.0';

  if (
    !pageId ||
    !/^\d+$/.test(pageId) ||
    !accessToken
  ) {
    return errorResponse(
      'Facebook Page publishing is not configured on the server.',
      503,
    );
  }

  if (!/^v\d+\.\d+$/.test(version)) {
    return errorResponse(
      'Facebook Graph API version is not configured correctly.',
      503,
    );
  }

  // 8. Publish photo with caption in one request
  try {
    const imageBuffer = await image.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);

    // Validate PNG signature
    if (
      !PNG_SIGNATURE.every(
        (value, index) => bytes[index] === value,
      )
    ) {
      return errorResponse(
        'The uploaded file is not a valid PNG image.',
        400,
      );
    }

    const upload = new FormData();

    upload.set(
      'source',
      new Blob([imageBuffer], {
        type: 'image/png',
      }),
      'gaming-news.png',
    );

    upload.set('caption', caption);
    upload.set('published', 'true');
    upload.set('access_token', accessToken);

    console.log('[Facebook Publish] Starting photo post', {
      pageId,
      version,
      imageSize: image.size,
      captionLength: caption.length,
    });

    const startedAt = Date.now();

    const response = await fetch(
      `https://graph.facebook.com/${version}/${pageId}/photos`,
      {
        method: 'POST',
        body: upload,
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      },
    );

    console.log('[Facebook Publish] Response received', {
      step: 'photo_publish',
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    const result = await response.json().catch(() => null);

    const fbError = safeFacebookError(
      result?.error,
      accessToken,
    );

    console.log('[Facebook Publish] Response body', {
      step: 'photo_publish',
      success: response.ok,
      error: fbError,
      hasId: typeof result?.id === 'string',
      hasPostId: typeof result?.post_id === 'string',
    });

    // 9. Handle Facebook API errors
    if (
      !response.ok ||
      result?.error ||
      typeof result?.id !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          stage: 'photo_publish',
          error:
            fbError?.message ||
            'Facebook rejected the photo publication.',
          facebookError: fbError
            ? {
              type: fbError.type,
              code: fbError.code,
              error_subcode: fbError.error_subcode,
            }
            : null,
        },
        { status: 502 },
      );
    }

    // 10. Return publishing result
    return NextResponse.json({
      success: true,
      photoId: result.id,
      postId: result.post_id || null,
      message: 'Facebook photo published successfully.',
    });

  } catch (e) {
    console.error('[Facebook Publish] Request failed', {
      errorName:
        e instanceof Error
          ? e.name
          : 'UnknownError',
    });

    return errorResponse(
      'Unable to publish the photo to Facebook.',
      502,
    );
  }
}
