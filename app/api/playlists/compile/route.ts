import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseM3U, IPTVChannel, IPTVPlaylist } from '@/lib/iptv-parser';
import { normalizeCategory } from '@/lib/github-playlists';

export const dynamic = 'force-dynamic';

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
 * Formats a filename into a beautiful category title.
 * e.g., sports.txt -> Sports, worldcup.m3u -> Worldcup or World Cup
 */
function deriveCategoryFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename)).toLowerCase();
  if (base === 'sports') return 'Sports';
  if (base === 'bangla') return 'Bangla / Bangladesh';
  if (base === 'movies') return 'Movies';
  if (base === 'kids') return 'Kids';
  if (base === 'news') return 'News';
  if (base === 'international') return 'International';
  if (base === 'music') return 'Music';
  if (base === 'radio') return 'Radio';

  // Format nicely: world_cup or world-cup -> World Cup
  return base
    .split(/[-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Checks if a URL points directly to a known stream file type without fetching.
 */
function isDirectStreamUrl(url: string): boolean {
  try {
    const u = url.toLowerCase().split('?')[0];
    return (
      u.endsWith('.m3u8') ||
      u.endsWith('.mp4') ||
      u.endsWith('.ts') ||
      url.includes('/live/') ||
      url.includes('/mono.ts')
    );
  } catch (e) {
    return false;
  }
}

/**
 * Fetches a remote URL with a strict timeout.
 */
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      }
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const playlistsDir = path.join(process.cwd(), 'public', 'playlists');

    if (!fs.existsSync(playlistsDir)) {
      console.warn('Playlists directory does not exist at:', playlistsDir);
      return NextResponse.json({
        id: 'github_public',
        name: 'Public Playlist',
        channelsCount: 0,
        channels: [],
        url: 'local://github_public',
        isOwnerManaged: true
      });
    }

    // 1. Load category overrides if available
    let overrides: Record<string, string> = {};
    const overridesPath = path.join(playlistsDir, 'category-overrides.json');
    if (fs.existsSync(overridesPath)) {
      try {
        const content = await fs.promises.readFile(overridesPath, 'utf8');
        overrides = JSON.parse(content);
      } catch (e) {
        console.warn('Could not parse category-overrides.json:', e);
      }
    }

    // 2. Scan all target files in /public/playlists/
    const allFiles = await fs.promises.readdir(playlistsDir);
    const targetFiles = allFiles.filter(filename => {
      const ext = path.extname(filename).toLowerCase();
      return ext === '.txt' || ext === '.m3u' || ext === '.m3u8';
    });

    console.log(`Discovered ${targetFiles.length} playlist files:`, targetFiles);

    const allChannels: IPTVChannel[] = [];

    // 3. Process each file
    for (const filename of targetFiles) {
      const filePath = path.join(playlistsDir, filename);
      const fallbackCategory = deriveCategoryFromFilename(filename);

      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const trimmedContent = content.trim();

        if (!trimmedContent) continue;

        // Check if the file is a real M3U playlist file
        const isRealM3U = trimmedContent.includes('#EXTM3U') || trimmedContent.includes('#EXTINF:');

        if (isRealM3U) {
          // Parse directly
          const parsedChannels = parseM3U(trimmedContent);
          for (const ch of parsedChannels) {
            let category = '';
            if (overrides && overrides[ch.name]) {
              category = overrides[ch.name];
            } else if (ch.group && ch.group.toLowerCase() !== 'general' && ch.group.toLowerCase() !== 'other' && ch.group.trim() !== '') {
              category = ch.group;
            } else {
              category = fallbackCategory;
            }

            allChannels.push({
              ...ch,
              id: ch.id || generateHashId(ch.name, ch.url),
              group: normalizeCategory(category)
            });
          }
        } else {
          // Treat as a list of lines (one URL or stream per line)
          const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

          if (lines.length === 1 && isDirectStreamUrl(lines[0])) {
            // Treat as a single HLS stream channel
            const streamUrl = lines[0];
            const channelName = fallbackCategory;
            let category = overrides[channelName] || fallbackCategory;

            allChannels.push({
              id: generateHashId(channelName, streamUrl),
              name: channelName,
              logo: null,
              group: normalizeCategory(category),
              url: streamUrl,
              country: 'International',
              language: 'English'
            });
          } else {
            // Treat as a list of M3U/HLS playlist/stream URLs
            for (const line of lines) {
              if (isDirectStreamUrl(line)) {
                // Direct stream URL
                const channelName = nameFromUrl(line);
                let category = overrides[channelName] || fallbackCategory;
                allChannels.push({
                  id: generateHashId(channelName, line),
                  name: channelName,
                  logo: null,
                  group: normalizeCategory(category),
                  url: line,
                  country: 'International',
                  language: 'English'
                });
              } else if (line.startsWith('http://') || line.startsWith('https://')) {
                // Remote M3U/M3U8 playlist URL
                try {
                  const fetchedText = await fetchWithTimeout(line);
                  if (fetchedText.includes('#EXTM3U') || fetchedText.includes('#EXTINF:')) {
                    const parsedChannels = parseM3U(fetchedText);
                    for (const ch of parsedChannels) {
                      let category = '';
                      if (overrides && overrides[ch.name]) {
                        category = overrides[ch.name];
                      } else if (ch.group && ch.group.toLowerCase() !== 'general' && ch.group.toLowerCase() !== 'other' && ch.group.trim() !== '') {
                        category = ch.group;
                      } else {
                        category = fallbackCategory;
                      }

                      allChannels.push({
                        ...ch,
                        id: ch.id || generateHashId(ch.name, ch.url),
                        group: normalizeCategory(category)
                      });
                    }
                  } else if (isDirectStreamUrl(fetchedText.trim())) {
                    // Sometimes a fetched URL returns a redirect stream URL
                    const finalStreamUrl = fetchedText.trim();
                    const channelName = nameFromUrl(finalStreamUrl);
                    let category = overrides[channelName] || fallbackCategory;
                    allChannels.push({
                      id: generateHashId(channelName, finalStreamUrl),
                      name: channelName,
                      logo: null,
                      group: normalizeCategory(category),
                      url: finalStreamUrl,
                      country: 'International',
                      language: 'English'
                    });
                  }
                } catch (fetchErr) {
                  console.error(`Failed to fetch and parse remote URL source [${line}] in file [${filename}]:`, fetchErr);
                }
              }
            }
          }
        }
      } catch (fileErr) {
        console.error(`Error reading or processing file [${filename}]:`, fileErr);
      }
    }

    // 4. Deduplicate channels by normalized stream URL
    const seenUrls = new Set<string>();
    const deduplicatedChannels: IPTVChannel[] = [];

    for (const ch of allChannels) {
      const normUrl = ch.url.trim().toLowerCase();
      if (!seenUrls.has(normUrl)) {
        seenUrls.add(normUrl);
        deduplicatedChannels.push(ch);
      }
    }

    console.log(`Total channels parsed: ${allChannels.length}, deduplicated: ${deduplicatedChannels.length}`);

    // 5. Package and return the merged playlist
    const publicPlaylist: IPTVPlaylist = {
      id: 'github_public',
      name: 'Public Playlist',
      channelsCount: deduplicatedChannels.length,
      channels: deduplicatedChannels,
      url: 'local://github_public',
      isOwnerManaged: true
    };

    return NextResponse.json(publicPlaylist);

  } catch (err: any) {
    console.error('Fatal error in server-side playlist compiler route:', err);
    return NextResponse.json({
      id: 'github_public',
      name: 'Public Playlist',
      channelsCount: 0,
      channels: [],
      url: 'local://github_public',
      isOwnerManaged: true,
      error: err.message || 'Unknown internal error'
    });
  }
}
