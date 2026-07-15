import { parseM3U, IPTVChannel, IPTVPlaylist } from './iptv-parser';

export interface PublicPlaylistFile {
  file: string;
  fallbackCategory: string;
}

export const PUBLIC_PLAYLIST_FILES: PublicPlaylistFile[] = [
  { file: 'sports.txt', fallbackCategory: 'Sports' },
  { file: 'bangla.txt', fallbackCategory: 'Bangla / Bangladesh' },
  { file: 'movies.txt', fallbackCategory: 'Movies' },
  { file: 'kids.txt', fallbackCategory: 'Kids' },
  { file: 'news.txt', fallbackCategory: 'News' },
  { file: 'international.txt', fallbackCategory: 'International' },
  { file: 'music.txt', fallbackCategory: 'Music' },
  { file: 'radio.txt', fallbackCategory: 'Radio' },
];

/**
 * Standardizes and normalizes category names to the requested variations.
 */
export function normalizeCategory(category: string): string {
  const cat = category.trim().toLowerCase();
  if (!cat) return 'Other';

  if (['sport', 'sports', 'football', 'cricket', 'live sports'].some(v => cat === v || cat.includes(v))) {
    return 'Sports';
  }
  if (['news', 'breaking news', '24 hour news'].some(v => cat === v || cat.includes(v))) {
    return 'News';
  }
  if (['movie', 'movies', 'cinema', 'films'].some(v => cat === v || cat.includes(v))) {
    return 'Movies';
  }
  if (['entertainment', 'general entertainment', 'drama', 'series'].some(v => cat === v || cat.includes(v))) {
    return 'Entertainment';
  }
  if (['kids', 'children', 'cartoon'].some(v => cat === v || cat.includes(v))) {
    return 'Kids';
  }
  if (cat === 'music' || cat.includes('music')) {
    return 'Music';
  }
  if (cat === 'radio' || cat.includes('radio')) {
    return 'Radio';
  }
  if (['international', 'world'].some(v => cat === v || cat.includes(v))) {
    return 'International';
  }
  if (['bangla', 'bangladesh', 'bd'].some(v => cat === v || cat.includes(v))) {
    return 'Bangla / Bangladesh';
  }

  // Capitalize first letter as fallback
  return category.trim().charAt(0).toUpperCase() + category.trim().slice(1);
}

/**
 * Derives a human-readable channel name from a direct stream URL.
 */
function nameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
    const withoutExt = lastSegment.replace(/\.[^/.]+$/, "");
    if (withoutExt && withoutExt.length > 2) {
      return withoutExt
        .split(/[-_]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return parsed.hostname;
  } catch (e) {
    return 'Direct Stream';
  }
}

/**
 * Helper to generate simple hash IDs for channels
 */
function generateHashId(name: string, url: string): string {
  const str = `${name}-${url}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'pub_' + Math.abs(hash).toString(36);
}

/**
 * Fetches and parses a single remote source URL.
 * Supports both M3U playlists and direct HLS stream URLs.
 */
async function fetchAndParseSource(
  url: string,
  fallbackCategory: string,
  overrides: Record<string, string>
): Promise<IPTVChannel[]> {
  let text = '';
  let fetched = false;

  // 1. Try local proxy
  try {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      text = await res.text();
      fetched = true;
    }
  } catch (e) {
    console.warn(`Local proxy failed for ${url}:`, e);
  }

  // 2. Try public proxy fallback
  if (!fetched) {
    try {
      const publicProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(publicProxy);
      if (res.ok) {
        text = await res.text();
        fetched = true;
      }
    } catch (e) {
      console.warn(`Public proxy failed for ${url}:`, e);
    }
  }

  // 3. Try direct fetch
  if (!fetched) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        text = await res.text();
        fetched = true;
      }
    } catch (e) {
      console.warn(`Direct fetch failed for ${url}:`, e);
    }
  }

  if (!fetched || !text) {
    throw new Error(`Failed to retrieve content for source URL: ${url}`);
  }

  // Detect if the content is an M3U file
  const isM3U = text.includes('#EXTM3U') || text.includes('#EXTINF:');

  if (isM3U) {
    const parsedChannels = parseM3U(text);
    if (parsedChannels.length > 0) {
      // Map and apply priority-based categories to each channel
      return parsedChannels.map(ch => {
        let category = '';

        // Category Priority:
        // 1. Manual override from category-overrides.json
        if (overrides && overrides[ch.name]) {
          category = overrides[ch.name];
        }

        // 2 & 3. Valid M3U group-title or existing channel category metadata
        if (!category && ch.group && ch.group.toLowerCase() !== 'general' && ch.group.toLowerCase() !== 'other' && ch.group.trim() !== '') {
          category = ch.group;
        }

        // 4. Keyword detection is already done inside parseM3U and returns group-title fallback.
        // But let's verify if group-title fell back to 'General', in which case we can use filename as fallback.
        if (!category && (!ch.group || ch.group.toLowerCase() === 'general' || ch.group.toLowerCase() === 'other')) {
          category = fallbackCategory;
        }

        if (!category) {
          category = fallbackCategory || 'Other';
        }

        return {
          ...ch,
          group: normalizeCategory(category)
        };
      });
    }
  }

  // If not M3U or parsed channels is empty, treat as a direct supported stream URL
  const channelName = nameFromUrl(url);
  let category = '';

  // Apply Category Priority for direct stream:
  // 1. Manual override
  if (overrides && overrides[channelName]) {
    category = overrides[channelName];
  }
  // 2. Fallback category of the TXT file
  if (!category) {
    category = fallbackCategory || 'Other';
  }

  const singleChannel: IPTVChannel = {
    id: generateHashId(channelName, url),
    name: channelName,
    logo: null,
    group: normalizeCategory(category),
    url: url,
    country: 'International',
    language: 'English'
  };

  return [singleChannel];
}

/**
 * Core entry point: Reads TXT files, extracts URLs, fetches streams, normalize categories, deduplicates,
 * and compiles into public-facing playlists.
 */
export async function compileGitHubPlaylists(): Promise<IPTVPlaylist | null> {
  try {
    // 1. Load category overrides
    let overrides: Record<string, string> = {};
    try {
      const overRes = await fetch('/playlists/category-overrides.json');
      if (overRes.ok) {
        overrides = await overRes.json();
      }
    } catch (e) {
      console.warn('Could not load category overrides, using default empty overrides:', e);
    }

    // Map to track unique source URLs and their fallback category hints
    // Keep the first fallback category encountered or map them elegantly
    const uniqueSources = new Map<string, string>();

    // 2. Fetch known .txt source files and extract URLs
    for (const sourceFile of PUBLIC_PLAYLIST_FILES) {
      try {
        const res = await fetch(`/playlists/${sourceFile.file}`);
        if (!res.ok) continue;

        const content = await res.text();
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          // Ignore comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) {
            continue;
          }

          // Keep unique stream sources, mapping to fallback category
          if (!uniqueSources.has(trimmed)) {
            uniqueSources.set(trimmed, sourceFile.fallbackCategory);
          }
        }
      } catch (fileErr) {
        console.warn(`Failed to read public playlist source file: ${sourceFile.file}`, fileErr);
      }
    }

    if (uniqueSources.size === 0) {
      console.log('No sources specified in public playlist txt files.');
      return null;
    }

    // 3. Process each stream source independently with safe independent error handling
    const allChannels: IPTVChannel[] = [];

    const sourcePromises = Array.from(uniqueSources.entries()).map(async ([url, fallbackCategory]) => {
      try {
        const channels = await fetchAndParseSource(url, fallbackCategory, overrides);
        return channels;
      } catch (srcErr) {
        // Safe: independent error handling. A failed source does not crash other sources or the applet
        console.error(`Error loading public source URL (${url}):`, srcErr);
        return [];
      }
    });

    const results = await Promise.all(sourcePromises);
    for (const channels of results) {
      allChannels.push(...channels);
    }

    if (allChannels.length === 0) {
      return null;
    }

    // 4. Safe channel deduplication by stream URL
    const seenUrls = new Set<string>();
    const deduplicatedChannels: IPTVChannel[] = [];

    for (const ch of allChannels) {
      const normUrl = ch.url.trim().toLowerCase();
      if (!seenUrls.has(normUrl)) {
        seenUrls.add(normUrl);
        deduplicatedChannels.push(ch);
      }
    }

    // 5. Package as a premium-quality public playlist
    const publicPlaylist: IPTVPlaylist = {
      id: 'github_public',
      name: 'Public Playlist',
      channelsCount: deduplicatedChannels.length,
      channels: deduplicatedChannels,
      url: 'local://github_public',
      isOwnerManaged: true
    };

    return publicPlaylist;

  } catch (err) {
    console.error('Fatal error during compileGitHubPlaylists:', err);
    return null;
  }
}
