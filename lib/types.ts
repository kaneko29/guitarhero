// app/lib/types.ts
// Core data structures for lyrics and chords

// Base song metadata
interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  spotifyId: string;
  youtubeId?: string;
  duration: number; // milliseconds
  key?: string; // e.g., "C", "Am", "F#m"
  tempo?: number; // BPM
  timeSignature?: string; // e.g., "4/4", "3/4"
  createdAt: Date;
  updatedAt: Date;
}

// Lyric line with timing
interface LyricLine {
  id: string;
  timestamp: number; // milliseconds from song start
  endTimestamp?: number; // for karaoke-style word highlighting
  text: string;
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'instrumental';
  confidence?: number; // 0-1, for AI-generated timestamps
  chord?: string; // e.g., "Am", "F", "C/G"
}

// Word-level timing for advanced karaoke
interface WordTiming {
  word: string;
  start: number; // milliseconds
  end: number; // milliseconds
  confidence?: number;
  chord?: string; // Added chord field for word-level chord associations
}

// Enhanced lyric line with word timings
interface DetailedLyricLine extends LyricLine {
  words?: WordTiming[];
}

// Chord information
interface Chord {
  name: string; // e.g., "Am", "F", "C/G"
  root: string; // e.g., "A", "F", "C"
  quality: string; // e.g., "minor", "major", "dominant7"
  bass?: string; // for slash chords like C/G
  frets?: number[]; // guitar fingering [0,2,2,1,0,0] for Am
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

// Chord progression with timing
interface ChordSection {
  id: string;
  timestamp: number; // milliseconds from song start
  endTimestamp: number;
  chord: Chord;
  beats?: number; // how many beats this chord lasts
  position?: 'strong' | 'weak'; // beat position importance
  section: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'solo';
}

// Complete song data structure
interface SongData {
  song: Song;
  lyrics: DetailedLyricLine[];
  chords: ChordSection[];
  structure?: SongStructure; // verse, chorus, bridge order
  metadata: {
    source: {
      lyrics: 'manual' | 'genius' | 'musixmatch' | 'ai_generated';
      chords: 'manual' | 'ultimate_guitar' | 'ai_generated';
      timing: 'manual' | 'whisper' | 'forced_alignment';
    };
    accuracy: {
      lyrics: number; // 0-1 confidence score
      chords: number;
      timing: number;
    };
    lastProcessed: Date;
  };
}

// Song structure for navigation
interface SongStructure {
  sections: SongSection[];
  totalBars?: number;
}

interface SongSection {
  name: string; // "Verse 1", "Chorus", "Bridge"
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'solo' | 'instrumental';
  startTime: number; // milliseconds
  endTime: number;
  bars?: number;
  repetitions?: number; // for sections that repeat
}

// Database/Storage structures
interface SongCache {
  [spotifyId: string]: {
    data: SongData;
    lastAccessed: Date;
    accessCount: number;
  };
}

// For bulk operations and processing queues
interface ProcessingJob {
  id: string;
  spotifyId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  steps: {
    downloadAudio: boolean;
    extractLyrics: boolean;
    scrapeChords: boolean;
    alignTimings: boolean;
  };
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Utility types for API responses
type LyricsWithTiming = Pick<DetailedLyricLine, 'timestamp' | 'text' | 'words'>[];
type ChordProgression = Pick<ChordSection, 'timestamp' | 'chord' | 'beats'>[];

// Search and filtering
interface SongQuery {
  title?: string;
  artist?: string;
  key?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  hasChords?: boolean;
  hasTimedLyrics?: boolean;
  genre?: string;
}

// Export all types
export type {
  Song,
  LyricLine,
  WordTiming,
  DetailedLyricLine,
  Chord,
  ChordSection,
  SongData,
  SongStructure,
  SongSection,
  SongCache,
  ProcessingJob,
  LyricsWithTiming,
  ChordProgression,
  SongQuery
};