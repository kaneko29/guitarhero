// app/lib/lrclib.ts
// Client for fetching LRC files from LRCLIB.net

interface LRCLIBSearchResult {
    id: number;
    name: string;
    trackName: string;
    artistName: string;
    albumName: string;
    duration: number;
    instrumental: boolean;
    plainLyrics: string;
    syncedLyrics: string | null;
  }
  
  interface LRCLIBSearchParams {
    artist_name?: string;
    track_name?: string;
    album_name?: string;
    duration?: number; // in seconds
  }
  
  interface LRCLIBGetParams {
    track_name: string;
    artist_name: string;
    album_name?: string;
    duration?: number;
  }
  
  class LRCLIBError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
      this.name = 'LRCLIBError';
    }
  }
  
  /**
   * LRCLIB API Client
   */
  export class LRCLIBClient {
    private baseUrl = 'https://lrclib.net/api';
    private userAgent = 'GuitarHero/1.0 (your-email@example.com)'; // Replace with your info
  
    /**
     * Search for lyrics by artist and track name
     */
    async search(params: LRCLIBSearchParams): Promise<LRCLIBSearchResult[]> {
      const searchParams = new URLSearchParams();
      
      if (params.artist_name) searchParams.append('artist_name', params.artist_name);
      if (params.track_name) searchParams.append('track_name', params.track_name);
      if (params.album_name) searchParams.append('album_name', params.album_name);
      if (params.duration) searchParams.append('duration', params.duration.toString());
  
      const url = `${this.baseUrl}/search?${searchParams.toString()}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json',
          },
        });
  
        if (!response.ok) {
          throw new LRCLIBError(`Search failed: ${response.statusText}`, response.status);
        }
  
        return await response.json();
      } catch (error) {
        if (error instanceof LRCLIBError) throw error;
        throw new LRCLIBError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  
    /**
     * Get lyrics by exact match (more reliable than search)
     */
    async get(params: LRCLIBGetParams): Promise<LRCLIBSearchResult | null> {
      const searchParams = new URLSearchParams();
      searchParams.append('track_name', params.track_name);
      searchParams.append('artist_name', params.artist_name);
      if (params.album_name) searchParams.append('album_name', params.album_name);
      if (params.duration) searchParams.append('duration', params.duration.toString());
  
      const url = `${this.baseUrl}/get?${searchParams.toString()}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json',
          },
        });
  
        if (response.status === 404) {
          return null; // No lyrics found
        }
  
        if (!response.ok) {
          throw new LRCLIBError(`Get failed: ${response.statusText}`, response.status);
        }
  
        return await response.json();
      } catch (error) {
        if (error instanceof LRCLIBError) throw error;
        throw new LRCLIBError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  
    /**
     * Get lyrics by ID
     */
    async getById(id: number): Promise<LRCLIBSearchResult | null> {
      const url = `${this.baseUrl}/get/${id}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json',
          },
        });
  
        if (response.status === 404) {
          return null;
        }
  
        if (!response.ok) {
          throw new LRCLIBError(`Get by ID failed: ${response.statusText}`, response.status);
        }
  
        return await response.json();
      } catch (error) {
        if (error instanceof LRCLIBError) throw error;
        throw new LRCLIBError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  // Singleton instance
  export const lrclibClient = new LRCLIBClient();
  
  /**
   * High-level helper functions
   */
  
  /**
   * Get synced lyrics for a song with fallback strategy
   */
  export async function getSyncedLyrics(
    artist: string,
    title: string,
    album?: string,
    duration?: number
  ): Promise<string | null> {
    try {
      // Try exact match first
      const exactResult = await lrclibClient.get({
        track_name: title,
        artist_name: artist,
        album_name: album,
        duration: duration
      });
  
      if (exactResult?.syncedLyrics) {
        return exactResult.syncedLyrics;
      }
  
      // Fallback to search
      const searchResults = await lrclibClient.search({
        artist_name: artist,
        track_name: title,
        album_name: album,
        duration: duration
      });
  
      // Find best match with synced lyrics
      const bestMatch = searchResults.find(result => 
        result.syncedLyrics && 
        result.artistName.toLowerCase().includes(artist.toLowerCase()) &&
        result.trackName.toLowerCase().includes(title.toLowerCase())
      );
  
      return bestMatch?.syncedLyrics || null;
    } catch (error) {
      console.error('Failed to get synced lyrics:', error);
      return null;
    }
  }
  
  /**
   * Get any lyrics (synced or plain) for a song
   */
  export async function getAnyLyrics(
    artist: string,
    title: string,
    album?: string,
    duration?: number
  ): Promise<{ synced: string | null; plain: string | null }> {
    try {
      const result = await lrclibClient.get({
        track_name: title,
        artist_name: artist,
        album_name: album,
        duration: duration
      });
  
      if (result) {
        return {
          synced: result.syncedLyrics,
          plain: result.plainLyrics
        };
      }
  
      // Fallback to search
      const searchResults = await lrclibClient.search({
        artist_name: artist,
        track_name: title
      });
  
      const bestMatch = searchResults[0]; // Take first result
      return {
        synced: bestMatch?.syncedLyrics || null,
        plain: bestMatch?.plainLyrics || null
      };
    } catch (error) {
      console.error('Failed to get lyrics:', error);
      return { synced: null, plain: null };
    }
  }
  
  /**
   * Search with fuzzy matching for better results
   */
  export async function searchLyricsFuzzy(
    query: string
  ): Promise<LRCLIBSearchResult[]> {
    // Simple fuzzy search - split query and try different combinations
    const words = query.toLowerCase().split(/[\s\-]+/);
    
    if (words.length >= 2) {
      // Try "artist - song" format
      const artist = words.slice(0, Math.floor(words.length / 2)).join(' ');
      const track = words.slice(Math.floor(words.length / 2)).join(' ');
      
      const results = await lrclibClient.search({
        artist_name: artist,
        track_name: track
      });
      
      if (results.length > 0) return results;
    }
    
    // Fallback: search just by track name
    return await lrclibClient.search({
      track_name: query
    });
  }
  
  /**
   * Cache wrapper for better performance
   */
  class LyricsCache {
    private cache = new Map<string, { data: any; timestamp: number }>();
    private ttl = 1000 * 60 * 60; // 1 hour
  
    private getCacheKey(artist: string, title: string, album?: string): string {
      return `${artist.toLowerCase()}-${title.toLowerCase()}-${album?.toLowerCase() || ''}`;
    }
  
    async get(artist: string, title: string, album?: string): Promise<string | null> {
      const key = this.getCacheKey(artist, title, album);
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.ttl) {
        return cached.data;
      }
  
      const lyrics = await getSyncedLyrics(artist, title, album);
      
      if (lyrics) {
        this.cache.set(key, { data: lyrics, timestamp: Date.now() });
      }
      
      return lyrics;
    }
  
    clear(): void {
      this.cache.clear();
    }
  }
  
  export const lyricsCache = new LyricsCache();
  
  /**
   * Integration with Spotify track data
   */
  export async function getLyricsFromSpotifyTrack(track: {
    name: string;
    artists: Array<{ name: string }>;
    album?: { name: string };
    duration_ms?: number;
  }): Promise<string | null> {
    const artist = track.artists[0]?.name;
    const title = track.name;
    const album = track.album?.name;
    const duration = track.duration_ms ? Math.floor(track.duration_ms / 1000) : undefined;
  
    return await getSyncedLyrics(artist, title, album, duration);
  }