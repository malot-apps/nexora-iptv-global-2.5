'use client';

export interface ProxyProvider {
  id: string;
  name: string;
  description: string;
  getUrl: (targetUrl: string) => string;
}

export const PROXY_PROVIDERS: ProxyProvider[] = [
  {
    id: 'local',
    name: 'Local Next.js API Proxy',
    description: 'NEXORA server-side relay (recommended & safest)',
    getUrl: (targetUrl) => `/api/proxy?url=${encodeURIComponent(targetUrl)}`,
  },
  {
    id: 'corsproxy.io',
    name: 'CORSProxy.io',
    description: 'High-speed public media proxy',
    getUrl: (targetUrl) => `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
  },
  {
    id: 'allorigins',
    name: 'AllOrigins',
    description: 'Reliable backup public proxy',
    getUrl: (targetUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
  },
  {
    id: 'thingproxy',
    name: 'ThingProxy',
    description: 'Alternative fallback proxy',
    getUrl: (targetUrl) => `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
  },
  {
    id: 'direct',
    name: 'Direct Stream (No Proxy)',
    description: 'Bypass all proxies and load natively',
    getUrl: (targetUrl) => targetUrl,
  }
];

const PROXY_PREFERENCE_KEY = 'nexora_preferred_proxy';
const AUTO_PROXY_KEY = 'nexora_auto_proxy_enabled';

/**
 * Gets the preferred proxy ID from localStorage
 */
export function getPreferredProxyId(): string {
  if (typeof window === 'undefined') return 'local';
  return localStorage.getItem(PROXY_PREFERENCE_KEY) || 'local';
}

/**
 * Sets the preferred proxy ID to localStorage
 */
export function setPreferredProxyId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROXY_PREFERENCE_KEY, id);
}

/**
 * Gets whether automatic proxy routing is enabled
 */
export function isAutoProxyEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(AUTO_PROXY_KEY);
  return val === null ? true : val === 'true';
}

/**
 * Sets whether automatic proxy routing is enabled
 */
export function setAutoProxyEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_PROXY_KEY, enabled ? 'true' : 'false');
}

const corsCache = new Map<string, boolean>();

/**
 * Performs a lightweight pre-flight test to check if a URL is CORS-restricted or blocked
 */
export async function detectCorsIssue(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (url.startsWith('/') || url.startsWith(window.location.origin)) {
    return false;
  }

  // Check cache first for instant resolution!
  if (corsCache.has(url)) {
    const cachedResult = corsCache.get(url)!;
    console.log('[StreamProxy] CORS cache hit:', url, '=>', cachedResult ? 'CORS Restricted' : 'Wide Open');
    return cachedResult;
  }

  // Pre-filter obviously tricky hostnames that always enforce CORS (e.g., github raw, m3u8 playlists from external CDNs)
  const lowerUrl = url.toLowerCase();
  const knownRestrictedDomains = [
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'twitch.tv',
    'youtube.com',
    'live',
    'stream'
  ];
  if (knownRestrictedDomains.some(domain => lowerUrl.includes(domain))) {
    corsCache.set(url, true);
    return true;
  }

  const checkWithMethod = async (method: 'HEAD' | 'GET', headers: HeadersInit = {}): Promise<boolean> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800); // ultra-fast 800ms limit
    try {
      const res = await fetch(url, {
        method,
        mode: 'cors',
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          ...headers,
        }
      });
      clearTimeout(timeout);
      // If we fetched successfully or even got a structured response status, CORS headers are compatible
      return !res.ok && res.status !== 405 && res.status !== 403;
    } catch (error: any) {
      clearTimeout(timeout);
      // TypeError "Failed to fetch" in CORS mode means block, abort means timeout (we assume false to not trigger proxy unnecessarily)
      if (error.name === 'AbortError') {
        return false;
      }
      return true;
    }
  };

  try {
    // 1. Try a lightweight HEAD pre-flight first (0 payload bytes downloaded)
    let isRestricted = await checkWithMethod('HEAD');

    // 2. Fallback to GET with a single-byte Range header in case server rejects HEAD requests with 405/501
    if (isRestricted) {
      isRestricted = await checkWithMethod('GET', { 'Range': 'bytes=0-0' });
    }

    corsCache.set(url, isRestricted);
    return isRestricted;
  } catch (error: any) {
    console.warn('[StreamProxy] CORS pre-flight test failed (likely restricted):', url, error);
    corsCache.set(url, true);
    return true;
  }
}

/**
 * Formats a URL using the appropriate proxy provider
 */
export function formatProxiedUrl(url: string, providerId?: string): string {
  const activeId = providerId || getPreferredProxyId();
  const provider = PROXY_PROVIDERS.find(p => p.id === activeId) || PROXY_PROVIDERS[0];
  return provider.getUrl(url);
}
