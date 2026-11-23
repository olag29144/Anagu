import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { path?: string[] } | Promise<{ path?: string[] }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function resolveTargetUrl(
  rawBackendUrl: string,
  segments: string[],
  search: string,
): URL | null {
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBackendUrl.replace(/\/+$/, '') + '/');
  } catch {
    return null;
  }

  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    return null;
  }

  for (const segment of segments) {
    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      segment.includes('://') ||
      segment.includes('\\') ||
      segment.includes('\0')
    ) {
      return null;
    }
  }

  const encodedPath = segments.map((s) => encodeURIComponent(s)).join('/');
  const targetUrl = new URL(encodedPath + search, baseUrl);
  if (targetUrl.origin !== baseUrl.origin) {
    return null;
  }

  return targetUrl;
}

async function proxyRequest(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  if (req.headers.get('x-anagu-proxy') === '1') {
    return NextResponse.json(
      { error: 'Proxy loop detected; verify BACKEND_URL points to the NestJS backend' },
      { status: 508 },
    );
  }

  const rawBackendUrl = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''
  ).trim();

  if (!rawBackendUrl) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured', fallback: true },
      { status: 503 },
    );
  }

  const resolvedParams = await Promise.resolve(context.params);
  const segments = resolvedParams.path ?? [];
  if (segments.length === 0) {
    return NextResponse.json(
      { error: 'Missing backend endpoint path' },
      { status: 400 },
    );
  }

  const targetUrl = resolveTargetUrl(
    rawBackendUrl,
    segments,
    req.nextUrl.search,
  );
  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Invalid backend target URL or path' },
      { status: 400 },
    );
  }

  const forwardHeaders = new Headers();
  forwardHeaders.set('x-anagu-proxy', '1');
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    forwardHeaders.set('authorization', authHeader);
  }
  const contentType = req.headers.get('content-type');
  if (contentType) {
    forwardHeaders.set('content-type', contentType);
  }
  const accept = req.headers.get('accept');
  if (accept) {
    forwardHeaders.set('accept', accept);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers: forwardHeaders,
      body: hasBody && body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await upstream.arrayBuffer();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: 'Backend server unreachable', fallback: true },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}
