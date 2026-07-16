import { IPTVPlaylist } from './iptv-parser';

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
 * Core entry point: Fetches compiled playlists from the server-side API.
 * This guarantees dynamic filesystem scanning, CORS bypass, and seamless Vercel compatibility.
 */
export async function compileGitHubPlaylists(): Promise<IPTVPlaylist | null> {
  try {
    const res = await fetch(`/api/playlists/compile?t=${Date.now()}`);
    if (!res.ok) {
      console.error(`Failed to fetch compiled public playlists: ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Fatal error during compileGitHubPlaylists fetch:', err);
    return null;
  }
}
