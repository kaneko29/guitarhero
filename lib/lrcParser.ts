// app/lib/lrcParser.ts
// Parse LRC files into our data structure

import { DetailedLyricLine, WordTiming } from './types';

// LRC format examples:
// [00:12.50]Never gonna give you up
// [ar:Rick Astley]
// [ti:Never Gonna Give You Up]
// [00:16.80]Never gonna let you down
// [00:20.10]Never gonna run around and desert you

interface LrcMetadata {
  artist?: string;    // [ar:Artist Name]
  title?: string;     // [ti:Song Title]
  album?: string;     // [al:Album Name]
  author?: string;    // [au:Creator]
  length?: string;    // [length:04:18]
  by?: string;        // [by:Creator]
  offset?: number;    // [offset:1000] - milliseconds to shift all timestamps
}

interface ParsedLrc {
  metadata: LrcMetadata;
  lyrics: DetailedLyricLine[];
}

/**
 * Parse LRC file content into our data structure
 */
export function parseLrcFile(lrcContent: string): ParsedLrc {
  const lines = lrcContent.split('\n').map(line => line.trim()).filter(Boolean);
  const metadata: LrcMetadata = {};
  const lyrics: DetailedLyricLine[] = [];
  
  let lineId = 0;

  for (const line of lines) {
    // Check if it's a metadata line
    const metadataMatch = line.match(/^\[([a-z]+):(.+)\]$/i);
    if (metadataMatch) {
      const [, key, value] = metadataMatch;
      parseMetadata(key.toLowerCase(), value, metadata);
      continue;
    }

    // Check if it's a lyric line with timestamp
    const lyricMatch = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/);
    if (lyricMatch) {
      const [, minutes, seconds, centiseconds, text] = lyricMatch;
      
      const timestamp = (
        parseInt(minutes) * 60 * 1000 +
        parseInt(seconds) * 1000 +
        parseInt(centiseconds) * 10
      );

      // Apply offset if specified
      const adjustedTimestamp = timestamp + (metadata.offset || 0);

      lyrics.push({
        id: `line_${++lineId}`,
        timestamp: adjustedTimestamp,
        text: text.trim(),
        type: classifyLyricType(text.trim()),
        confidence: 1.0 // LRC files are usually manually created
      });
    }

    // Handle multiple timestamps for the same line
    // [00:12.50][01:15.20]This line repeats
    const multiTimestampMatch = line.match(/^(\[[\d:\.]+\])+(.*)$/);
    if (multiTimestampMatch && !lyricMatch) {
      const timestamps = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/g);
      const text = line.replace(/\[[\d:\.]+\]/g, '').trim();
      
      timestamps?.forEach(timestampStr => {
        const match = timestampStr.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
        if (match) {
          const [, minutes, seconds, centiseconds] = match;
          const timestamp = (
            parseInt(minutes) * 60 * 1000 +
            parseInt(seconds) * 1000 +
            parseInt(centiseconds) * 10
          );

          lyrics.push({
            id: `line_${++lineId}`,
            timestamp: timestamp + (metadata.offset || 0),
            text: text,
            type: classifyLyricType(text),
            confidence: 1.0
          });
        }
      });
    }
  }

  // Sort by timestamp
  lyrics.sort((a, b) => a.timestamp - b.timestamp);

  // Add end timestamps
  addEndTimestamps(lyrics);

  return { metadata, lyrics };
}

/**
 * Parse metadata tags
 */
function parseMetadata(key: string, value: string, metadata: LrcMetadata): void {
  switch (key) {
    case 'ar':
      metadata.artist = value;
      break;
    case 'ti':
      metadata.title = value;
      break;
    case 'al':
      metadata.album = value;
      break;
    case 'au':
      metadata.author = value;
      break;
    case 'length':
      metadata.length = value;
      break;
    case 'by':
      metadata.by = value;
      break;
    case 'offset':
      metadata.offset = parseInt(value);
      break;
  }
}

/**
 * Classify lyric type based on content
 */
function classifyLyricType(text: string): DetailedLyricLine['type'] {
  if (!text || text === '') return 'instrumental';
  
  const lowerText = text.toLowerCase();
  
  // Common patterns for different section types
  if (lowerText.includes('instrumental') || lowerText.includes('♪')) {
    return 'instrumental';
  }
  if (lowerText.includes('chorus') || lowerText.includes('refrain')) {
    return 'chorus';
  }
  if (lowerText.includes('bridge')) {
    return 'bridge';
  }
  if (lowerText.includes('outro') || lowerText.includes('fade')) {
    return 'outro';
  }
  if (lowerText.includes('intro')) {
    return 'intro';
  }
  
  // Default to verse
  return 'verse';
}

/**
 * Add end timestamps based on next line's start
 */
function addEndTimestamps(lyrics: DetailedLyricLine[]): void {
  for (let i = 0; i < lyrics.length - 1; i++) {
    lyrics[i].endTimestamp = lyrics[i + 1].timestamp;
  }
  
  // Last line gets a default duration of 3 seconds
  if (lyrics.length > 0) {
    const lastLine = lyrics[lyrics.length - 1];
    lastLine.endTimestamp = lastLine.timestamp + 3000;
  }
}

/**
 * Enhanced LRC parser that handles word-level timestamps
 * Format: [00:12.50]<00:12.50>Never <00:12.80>gonna <00:13.10>give...
 */
export function parseEnhancedLrc(lrcContent: string): ParsedLrc {
  const basicParsed = parseLrcFile(lrcContent);
  
  // Process word-level timestamps
  basicParsed.lyrics = basicParsed.lyrics.map(line => {
    const wordTimestamps = parseWordTimestamps(line.text);
    if (wordTimestamps.length > 0) {
      return {
        ...line,
        words: wordTimestamps,
        text: wordTimestamps.map(w => w.word).join(' ')
      };
    }
    return line;
  });

  return basicParsed;
}

/**
 * Parse word-level timestamps from enhanced LRC format
 */
function parseWordTimestamps(text: string): WordTiming[] {
  const words: WordTiming[] = [];
  const pattern = /<(\d{2}):(\d{2})\.(\d{2})>([^<]+)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const [, minutes, seconds, centiseconds, word] = match;
    const timestamp = (
      parseInt(minutes) * 60 * 1000 +
      parseInt(seconds) * 1000 +
      parseInt(centiseconds) * 10
    );

    words.push({
      word: word.trim(),
      start: timestamp,
      end: timestamp + 500, // Default 500ms duration, will be adjusted
      confidence: 1.0
    });
  }

  // Adjust end times based on next word's start
  for (let i = 0; i < words.length - 1; i++) {
    words[i].end = words[i + 1].start;
  }

  return words;
}

/**
 * Convert our data structure back to LRC format
 */
export function toLrcFormat(lyrics: DetailedLyricLine[], metadata?: LrcMetadata): string {
  let lrcContent = '';

  // Add metadata
  if (metadata) {
    if (metadata.title) lrcContent += `[ti:${metadata.title}]\n`;
    if (metadata.artist) lrcContent += `[ar:${metadata.artist}]\n`;
    if (metadata.album) lrcContent += `[al:${metadata.album}]\n`;
    if (metadata.author) lrcContent += `[au:${metadata.author}]\n`;
    if (metadata.length) lrcContent += `[length:${metadata.length}]\n`;
    if (metadata.offset) lrcContent += `[offset:${metadata.offset}]\n`;
    lrcContent += '\n';
  }

  // Add lyrics
  lyrics.forEach(line => {
    const minutes = Math.floor(line.timestamp / 60000);
    const seconds = Math.floor((line.timestamp % 60000) / 1000);
    const centiseconds = Math.floor((line.timestamp % 1000) / 10);

    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    
    if (line.words && line.words.length > 0) {
      // Enhanced format with word timings
      let enhancedText = '';
      line.words.forEach(word => {
        const wordMinutes = Math.floor(word.start / 60000);
        const wordSeconds = Math.floor((word.start % 60000) / 1000);
        const wordCentiseconds = Math.floor((word.start % 1000) / 10);
        const wordTimeStr = `${wordMinutes.toString().padStart(2, '0')}:${wordSeconds.toString().padStart(2, '0')}.${wordCentiseconds.toString().padStart(2, '0')}`;
        enhancedText += `<${wordTimeStr}>${word.word} `;
      });
      lrcContent += `[${timeStr}]${enhancedText.trim()}\n`;
    } else {
      // Standard format
      lrcContent += `[${timeStr}]${line.text}\n`;
    }
  });

  return lrcContent;
}

/**
 * Utility to load LRC file from various sources
 */
export async function loadLrcFile(source: string | File): Promise<ParsedLrc> {
  let content: string;

  if (typeof source === 'string') {
    // URL or file path
    const response = await fetch(source);
    content = await response.text();
  } else {
    // File object
    content = await source.text();
  }

  return parseEnhancedLrc(content);
}