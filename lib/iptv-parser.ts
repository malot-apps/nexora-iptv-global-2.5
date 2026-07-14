export interface IPTVChannel {
  id: string;
  name: string;
  logo: string | null;
  group: string;
  url: string;
  country: string;
  language: string;
  isFavorite?: boolean;
}

export interface IPTVPlaylist {
  id: string;
  name: string;
  channelsCount: number;
  url?: string;
  channels: IPTVChannel[];
  isOwnerManaged?: boolean;
}

/**
 * Parses a raw M3U string into typed IPTVChannel objects.
 */
export function parseM3U(m3uContent: string): IPTVChannel[] {
  const channels: IPTVChannel[] = [];
  const lines = m3uContent.split('\n');
  
  let currentInfo: {
    name: string;
    logo: string | null;
    group: string;
    country: string;
    language: string;
    id: string | null;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Parse info line
      // Format: #EXTINF:-1 tvg-id="id" tvg-name="name" tvg-logo="logo" group-title="group",Channel Name
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i) || line.match(/logo="([^"]+)"/i);
      const groupMatch = line.match(/group-title="([^"]+)"/i) || line.match(/group="([^"]+)"/i);
      const idMatch = line.match(/tvg-id="([^"]+)"/i);
      
      const countryMatch = line.match(/tvg-country="([^"]+)"/i) || line.match(/country="([^"]+)"/i) || line.match(/tvg-country-code="([^"]+)"/i);
      const langMatch = line.match(/tvg-language="([^"]+)"/i) || line.match(/language="([^"]+)"/i) || line.match(/tvg-lang="([^"]+)"/i);

      // Extract the name (everything after the last comma)
      const commaIndex = line.lastIndexOf(',');
      let name = '';
      if (commaIndex !== -1) {
        name = line.substring(commaIndex + 1).trim();
      } else {
        // Fallback: parse tvg-name or some other identifier
        const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
        name = tvgNameMatch ? tvgNameMatch[1] : 'Unknown Channel';
      }

      const logo = logoMatch ? logoMatch[1] : null;
      let group = groupMatch ? groupMatch[1] : '';

      // Auto Category Detection if group-title is missing or default
      if (!group || group.toLowerCase() === 'other' || group.trim() === '') {
        group = detectCategory(name);
      }

      const cleanedGroup = cleanGroupTitle(group);
      const country = countryMatch ? countryMatch[1] : detectCountry(name, cleanedGroup);
      const language = langMatch ? langMatch[1] : detectLanguage(name, cleanedGroup);

      currentInfo = {
        name,
        logo,
        group: cleanedGroup,
        country,
        language,
        id: idMatch ? idMatch[1] : null,
      };
    } else if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp') || line.endsWith('.m3u8') || line.includes('.mp4') || line.includes('/mono.ts') || line.includes('/live/') || line.includes('.ts')) {
      // Found a stream URL
      if (currentInfo) {
        const url = line;
        const channelId = currentInfo.id || generateUniqueId(currentInfo.name, url);
        
        channels.push({
          id: channelId,
          name: currentInfo.name,
          logo: currentInfo.logo,
          group: currentInfo.group,
          url: url,
          country: currentInfo.country,
          language: currentInfo.language,
        });
        
        currentInfo = null;
      }
    }
  }

  return channels;
}

/**
 * Standardizes category names dynamically without hardcoding.
 */
function cleanGroupTitle(group: string): string {
  const g = group.trim();
  if (!g) return 'General';
  // Capitalize first letter of whatever was in the group-title
  return g.charAt(0).toUpperCase() + g.slice(1);
}

/**
 * Auto detects category based on stream/channel name when group-title is missing
 */
function detectCategory(name: string): string {
  const n = name.toLowerCase();
  
  if (
    n.includes('sport') || n.includes('football') || n.includes('soccer') || 
    n.includes('bein') || n.includes('espn') || n.includes('arena') || 
    n.includes('sky s') || n.includes('eurosport') || n.includes('ufc') || 
    n.includes('fight') || n.includes('racing') || n.includes('f1') || 
    n.includes('golf') || n.includes('tennis') || n.includes('nba') ||
    n.includes('nfl') || n.includes('mlb') || n.includes('extre') ||
    n.includes('wwe') || n.includes('billiards') || n.includes('brent') ||
    n.includes('cricket') || n.includes('league') || n.includes('cup')
  ) {
    return 'Sports';
  }
  
  if (
    n.includes('news') || n.includes('bbc') || n.includes('cnn') || 
    n.includes('al jazeera') || n.includes('msnbc') || n.includes('fox n') || 
    n.includes('cnbc') || n.includes('bloomberg') || n.includes('sky n') ||
    n.includes('weather') || n.includes('dw') || n.includes('rt') || n.includes('euronews')
  ) {
    return 'News';
  }
  
  if (
    n.includes('movie') || n.includes('cinema') || n.includes('action') || 
    n.includes('hbo') || n.includes('cine') || n.includes('film') || 
    n.includes('hollywood') || n.includes('thriller') || n.includes('comedy') ||
    n.includes('blockbuster')
  ) {
    return 'Movies';
  }
  
  if (
    n.includes('music') || n.includes('mtv') || n.includes('viva') || 
    n.includes('songs') || n.includes('radio') || n.includes('clubland') ||
    n.includes('jazz') || n.includes('rock') || n.includes('pop')
  ) {
    return 'Music';
  }
  
  if (
    n.includes('kid') || n.includes('disney') || n.includes('cartoon') || 
    n.includes('nickelodeon') || n.includes('junior') || n.includes('toon') ||
    n.includes('anime') || n.includes('boomerang') || n.includes('baby')
  ) {
    return 'Kids';
  }
  
  if (
    n.includes('documentary') || n.includes('discovery') || n.includes('nat geo') || 
    n.includes('history') || n.includes('animal planet') || n.includes('science') ||
    n.includes('travel') || n.includes('wild') || n.includes('investigat')
  ) {
    return 'Documentary';
  }
  
  if (
    n.includes('series') || n.includes('netflix') || n.includes('episode') ||
    n.includes('drama') || n.includes('soap') || n.includes('sitcom')
  ) {
    return 'Series';
  }
  
  return 'General';
}

/**
 * Auto detects Country from channel name or group
 */
function detectCountry(name: string, group: string): string {
  const text = `${name} ${group}`.toLowerCase();
  if (text.includes('usa') || text.includes('united states') || text.includes('(us)') || text.includes('[us]') || text.includes('us:')) return 'United States';
  if (text.includes('uk') || text.includes('united kingdom') || text.includes('gb') || text.includes('(uk)') || text.includes('[uk]') || text.includes('uk:')) return 'United Kingdom';
  if (text.includes('canada') || text.includes('(ca)') || text.includes('[ca]') || text.includes('ca:')) return 'Canada';
  if (text.includes('france') || text.includes('(fr)') || text.includes('[fr]') || text.includes('fr:')) return 'France';
  if (text.includes('germany') || text.includes('deutsch') || text.includes('(de)') || text.includes('[de]') || text.includes('de:')) return 'Germany';
  if (text.includes('spain') || text.includes('espana') || text.includes('(es)') || text.includes('[es]') || text.includes('es:')) return 'Spain';
  if (text.includes('italy') || text.includes('italia') || text.includes('(it)') || text.includes('[it]') || text.includes('it:')) return 'Italy';
  if (text.includes('brazil') || text.includes('(br)') || text.includes('[br]') || text.includes('br:')) return 'Brazil';
  if (text.includes('argentina') || text.includes('(ar)') || text.includes('[ar]') || text.includes('ar:')) return 'Argentina';
  if (text.includes('india') || text.includes('hindi') || text.includes('(in)') || text.includes('[in]') || text.includes('in:')) return 'India';
  if (text.includes('bangladesh') || text.includes('bengali') || text.includes('bd') || text.includes('(bd)') || text.includes('[bd]') || text.includes('bd:')) return 'Bangladesh';
  if (text.includes('pakistan') || text.includes('urdu') || text.includes('(pk)') || text.includes('pk:')) return 'Pakistan';
  if (text.includes('arabic') || text.includes('uae') || text.includes('saudi') || text.includes('(ar)') || text.includes('ar:')) return 'Arab Emirates';
  return 'International';
}

/**
 * Auto detects Language from channel name or group
 */
function detectLanguage(name: string, group: string): string {
  const text = `${name} ${group}`.toLowerCase();
  if (text.includes('english') || text.includes('usa') || text.includes('uk') || text.includes('ca') || text.includes('(us)') || text.includes('(uk)')) return 'English';
  if (text.includes('spanish') || text.includes('espanol') || text.includes('espana') || text.includes('(es)')) return 'Spanish';
  if (text.includes('french') || text.includes('francais') || text.includes('(fr)')) return 'French';
  if (text.includes('german') || text.includes('deutsch') || text.includes('(de)')) return 'German';
  if (text.includes('italian') || text.includes('italiano') || text.includes('(it)')) return 'Italian';
  if (text.includes('portuguese') || text.includes('portugues') || text.includes('brazil') || text.includes('(br)')) return 'Portuguese';
  if (text.includes('hindi') || text.includes('india') || text.includes('(in)')) return 'Hindi';
  if (text.includes('bengali') || text.includes('bangla') || text.includes('bd')) return 'Bengali';
  if (text.includes('arabic') || text.includes('arab') || text.includes('saudi')) return 'Arabic';
  if (text.includes('urdu') || text.includes('punjabi') || text.includes('pakistan')) return 'Urdu';
  return 'English';
}

/**
 * Simple hash function to generate short unique IDs for channels
 */
function generateUniqueId(name: string, url: string): string {
  const str = `${name}-${url}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'ch_' + Math.abs(hash).toString(36);
}
