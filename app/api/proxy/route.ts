import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ message: "API not available on static export" });
  }

  const reqUrl = req ? req['url'] : '';
  const urlParam = reqUrl ? new URL(reqUrl).searchParams.get('url') : null;

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(urlParam);
    
    // Add safety checks
    const targetUrl = new URL(decodedUrl);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
    }

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      // Short timeout to keep server snappy
      next: { revalidate: 600 } // Cache for 10 mins
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch target URL. Status: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'text/plain';
    const text = await response.text();

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: `Proxy failed to fetch the URL: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
