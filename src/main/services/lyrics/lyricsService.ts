import { LyricLine } from '../../../types';

export class LyricsService {
  private cache: Map<string, LyricLine[]> = new Map();

  async getLyrics(title: string, artist: string): Promise<LyricLine[]> {
    if (!title || title === 'Tidak ada media') return [];
    
    // Clean track title (strip out extra (Official Video), [MV], etc.)
    const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = artist.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cacheKey = `${cleanArtist} - ${cleanTitle}`.toLowerCase();

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(url);
      if (!res.ok) {
        // Try searching if exact get fails
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) return [];
        const items = await searchRes.json();
        if (Array.isArray(items) && items.length > 0 && items[0].syncedLyrics) {
          const parsed = this.parseLRC(items[0].syncedLyrics);
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
        return [];
      }

      const data = await res.json();
      if (data && data.syncedLyrics) {
        const parsed = this.parseLRC(data.syncedLyrics);
        this.cache.set(cacheKey, parsed);
        return parsed;
      }
    } catch {
      // Fallback gracefully
    }

    return [];
  }

  private parseLRC(lrcText: string): LyricLine[] {
    const lines = lrcText.split('\n');
    const result: LyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

    for (const line of lines) {
      const match = line.match(timeRegex);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const millis = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
        const totalSeconds = minutes * 60 + seconds + millis / 1000;
        const text = match[4].trim();
        if (text) {
          result.push({ time: totalSeconds, text });
        }
      }
    }

    return result.sort((a, b) => a.time - b.time);
  }
}
