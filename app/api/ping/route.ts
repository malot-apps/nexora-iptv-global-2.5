import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(urlParam);
    
    // Safety check on protocol
    const targetUrl = new URL(decodedUrl);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return NextResponse.json({ reachable: false, error: 'Invalid URL protocol' });
    }

    // Set a lightweight signal with 3.5s timeout for fast UI responsiveness
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(decodedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return NextResponse.json({
      reachable: response.ok || (response.status >= 200 && response.status < 400),
      status: response.status
    });
  } catch (error: any) {
    // Treat any connection timeout/dns failure/cors as unreachable
    return NextResponse.json({
      reachable: false,
      error: error.message || 'Connection timeout or unreachable stream host'
    });
  }
}
