'use client'

import { useEffect, useState, useRef } from 'react'
import { use } from 'react'
import { getSyncedLyrics } from '@/lib/lrclib'
import { parseLrcFile } from '@/lib/lrcParser'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { WordTiming, ChordPlacement } from '@/lib/types'

import { useUser, useUserLoading } from '@/app/providers/UserProvider'

import SpotifyPlayer, { SpotifyPlayerRef } from '../../../components/SpotifyPlayer'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, Music, AlertCircle, Maximize2, Minimize2 } from 'lucide-react'
import { useChordData } from '@/lib/dynamicChords'
import { ChordDiagram } from '@/app/components/ChordDiagram'

type Props = {
  params: Promise<{
    artist: string
    song: string
  }>
}

interface Chord {
  id: number
  chord_name: string
  position: number
  chord_position?: number
}

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  spotify_id?: string;
  spotify_uri?: string;
  youtubeId?: string;
  duration?: number;
  key?: string;
  tempo?: number;
  timeSignature?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
  genre_id?: number | null;
}

async function getProcessedLyrics(artist: string, title: string) {
  // Get lyrics from database
  const { data: songData, error: songError } = await supabase
    .from('songs')
    .select('lyrics')
    .eq('artist', artist)
    .eq('title', title)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (songError || !songData?.lyrics) {
    // Fallback to API if no lyrics in database
    const lrcContent = await getSyncedLyrics(artist, title)
    if (!lrcContent) return null
    const parsed = parseLrcFile(lrcContent)
    return parsed.lyrics
  }

  return songData.lyrics
}

export default function SongPage({ params }: Props) {
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [clickedLineIndex, setClickedLineIndex] = useState<number | null>(null)
  const [lyricData, setLyricData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [chordPlacements, setChordPlacements] = useState<ChordPlacement[]>([])
  const [chords, setChords] = useState<Chord[]>([])
  const [songData, setSongData] = useState<Song | null>(null)
  const { getChordData } = useChordData()
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const currentLineRef = useRef<HTMLDivElement>(null)
  const [hoveredChord, setHoveredChord] = useState<{ chord: string; position: number; lineIndex: number; placementIndex: number } | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const spotifyPlayerRef = useRef<SpotifyPlayerRef>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoscrollEnabled, setAutoscrollEnabled] = useState(true)

  const { artist, song } = use(params)
  // Clean the song parameter to remove any query parameters that might be attached
  // Handle cases where query parameters are embedded in the URL path
  console.log('Original song parameter:', song)
  const cleanSong = song
    .split('?')[0] // Remove everything after first ?
    .split('&')[0] // Remove everything after first &
    .split('#')[0] // Remove everything after first #
    .trim() // Remove any trailing whitespace
  console.log('Cleaned song parameter:', cleanSong)
  const decodedArtist = decodeURIComponent(artist)
  const decodedSong = decodeURIComponent(cleanSong)

  const searchParams = useSearchParams()
  const uri = searchParams.get('uri')
  const versionId = searchParams.get('version')
  const router = useRouter()

  const user = useUser() as any;
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genreError, setGenreError] = useState<string | null>(null);

  // Load song data including Spotify URI
  useEffect(() => {
    const loadSongData = async () => {
      try {
        const { data: songData, error: songError } = await supabase
          .from('songs')
          .select('*')
          .eq('artist', decodedArtist)
          .eq('title', decodedSong)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // If song not found in database, that's okay - we'll still try to load lyrics
        if (songError && songError.code === 'PGRST116') {
          // Don't set error here - we'll check lyrics first
          return
        }

        if (songError) throw songError

        if (songData) {
          setSongData(songData)
        }
      } catch (err) {
        console.error('Error loading song data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load song data')
      }
    }

    loadSongData()
  }, [decodedArtist, decodedSong])

  // Load saved chord data
  useEffect(() => {
    const loadSavedChords = async () => {
      try {
        // If version is 'karaoke', skip loading chords
        if (versionId === 'karaoke') {
          setChordPlacements([])
          setChords([])
          return
        }

        // Get the most recent song entry
        const { data: songData, error: songError } = await supabase
          .from('songs')
          .select('id, created_at')
          .eq('artist', decodedArtist)
          .eq('title', decodedSong)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // If no song found, just continue without chords
        if (songError && songError.code === 'PGRST116') {
          setChordPlacements([])
          setChords([])
          return
        }

        if (songError) throw songError

        if (songData) {
          let editData = null

          if (versionId) {
            // Get the specific version by ID
            const { data: specificEdit, error: specificError } = await supabase
              .from('song_edits')
              .select('chord_data, chords')
              .eq('id', versionId)
              .eq('song_id', songData.id)
              .single()

            if (specificError && specificError.code !== 'PGRST116') {
              throw specificError
            }

            editData = specificEdit
          } else {
            // Get the most recent edit
            const { data: recentEdit, error: recentError } = await supabase
              .from('song_edits')
              .select('chord_data, chords')
              .eq('song_id', songData.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (recentError && recentError.code !== 'PGRST116') {
              throw recentError
            }

            editData = recentEdit
          }

          if (editData) {
            setChordPlacements(editData.chord_data || [])
            setChords(editData.chords || [])
          } else {
            setChordPlacements([])
            setChords([])
          }
        }
      } catch (err) {
        console.error('Error loading saved chords:', err)
        // Only set error for unexpected errors, not for "no data found" cases
        if (err instanceof Error && !err.message.includes('No rows found')) {
          setError(err.message)
        }
      }
    }

    loadSavedChords()
  }, [decodedArtist, decodedSong, versionId])

  // Load synced lyrics
  useEffect(() => {
    const loadLyrics = async () => {
      try {
        const lyrics = await getProcessedLyrics(decodedArtist, decodedSong)
        if (!lyrics) {
          setError('No lyrics found for this song')
          return
        }
        setLyricData(lyrics)
        setError(null) // Clear any previous errors if lyrics are found
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lyrics')
      }
    }
    loadLyrics()
  }, [decodedArtist, decodedSong])

  useEffect(() => {
    if (!lyricData || !Array.isArray(lyricData)) return;

    const index = lyricData.findIndex(
      (line: { timestamp: number; endTimestamp: number }) =>
        playbackPosition >= line.timestamp && playbackPosition < line.endTimestamp
    );

    setCurrentLyricIndex(index);

    // Clear clicked line index when playback reaches that line
    if (clickedLineIndex !== null && index === clickedLineIndex) {
      setClickedLineIndex(null);
    }
  }, [playbackPosition, lyricData, clickedLineIndex]);

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLyricIndex === -1) return;
    // Use setTimeout to ensure refs are attached after DOM updates
    const timeout = setTimeout(() => {
      if (!currentLineRef.current) return;
      if (isFullscreen) {
        // Only autoscroll in fullscreen if enabled
        if (!autoscrollEnabled) return;
        currentLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (lyricsContainerRef.current) {
        // Always autoscroll in minimized mode
        const container = lyricsContainerRef.current;
        const currentLine = currentLineRef.current;
        const scrollTop = currentLine.offsetTop - container.offsetTop - (container.clientHeight / 2) + (currentLine.getBoundingClientRect().height / 2);
        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [currentLyricIndex, autoscrollEnabled, isFullscreen]);

  const handleBack = async () => {
    // Stop the Spotify player before navigating back
    if (spotifyPlayerRef.current) {
      try {
        console.log('Stopping Spotify player before navigation...')
        await spotifyPlayerRef.current.cleanup()
        console.log('Spotify player stopped successfully')
      } catch (error) {
        console.error('Error stopping Spotify player:', error)
      }
    }

    router.back()
  }

  // Function to get the position for a chord
  const getChordPosition = (chordName: string) => {
    const savedChord = chords.find(c => c.chord_name === chordName)
    return savedChord?.chord_position ?? 0
  }

  // Function to handle lyric line clicks
  const handleLyricClick = async (lineIndex: number) => {
    if (!lyricData || !lyricData[lineIndex] || !spotifyPlayerRef.current) return

    const line = lyricData[lineIndex]
    const timestamp = line.timestamp

    // Set the clicked line for immediate visual feedback
    setClickedLineIndex(lineIndex)

    try {
      console.log(`Seeking to timestamp: ${timestamp}ms (${Math.floor(timestamp / 1000)}s)`)
      await spotifyPlayerRef.current.seek(timestamp)
    } catch (error) {
      console.error('Error seeking to lyric timestamp:', error)
    }
  }

  // Fetch genres and current genre for this song
  useEffect(() => {
    const fetchGenres = async () => {
      const { data, error } = await supabase.from('genres').select('id, name').order('name');
      if (!error && data) setGenres(data);
    };
    fetchGenres();
  }, []);

  useEffect(() => {
    if (songData) setSelectedGenre(songData.genre_id || null);
  }, [songData]);

  const handleGenreChange = async (genreId: number | null) => {
    if (!songData) return;
    setGenreLoading(true);
    setGenreError(null);
    const { error } = await supabase.from('songs').update({ genre_id: genreId }).eq('id', songData.id);
    if (error) {
      setGenreError('Failed to update category');
    } else {
      setSelectedGenre(genreId);
    }
    setGenreLoading(false);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Song Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground capitalize">
              {decodedSong}
            </h1>
            <p className="text-xl text-muted-foreground capitalize">
              {decodedArtist}
            </p>
            {/* Admin-only Add Category dropdown */}
            {user?.is_admin && (
              <div className="mt-4 max-w-xs mx-auto">
                <label htmlFor="genre" className="block text-sm font-medium text-foreground mb-1">Category</label>
                <select
                  id="genre"
                  value={selectedGenre || ''}
                  onChange={e => handleGenreChange(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={genreLoading}
                >
                  <option value="">No category</option>
                  {genres.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {genreError && <p className="text-red-500 mt-2">{genreError}</p>}
              </div>
            )}
          </div>

          {/* Player and Lyrics Section */}
          <div className="grid gap-8">
            {/* Spotify Player */}
            <div className="bg-card border border-border rounded-lg p-6">
              <SpotifyPlayer
                ref={spotifyPlayerRef}
                trackUri={songData?.spotify_uri || uri || ''}
                onPositionChange={setPlaybackPosition}
              />
            </div>

            {/* Lyrics Display */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-foreground">Lyrics</h2>
                <div className="flex items-center gap-2">
                  {isFullscreen && (
                    <button
                      onClick={() => setAutoscrollEnabled((prev) => !prev)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${autoscrollEnabled ? 'bg-primary text-primary-foreground hover:bg-primary/80' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                      title={autoscrollEnabled ? 'Disable autoscroll' : 'Enable autoscroll'}
                    >
                      {autoscrollEnabled ? 'Autoscroll: On' : 'Autoscroll: Off'}
                    </button>
                  )}
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="h-4 w-4" />
                        <span className="text-sm">Minimize</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-4 w-4" />
                        <span className="text-sm">Fullscreen</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              {lyricData ? (
                isFullscreen ? (
                  <div ref={lyricsContainerRef} className="space-y-6">
                    {lyricData.map((line: any, lineIndex: number) => (
                      <div
                        key={lineIndex}
                        ref={lineIndex === currentLyricIndex ? currentLineRef : null}
                        className="p-4 bg-background/50 rounded-md"
                      >
                        {/* Chord selectors and text container */}
                        <div className="relative min-h-[2.5rem]">
                          {/* Display chords */}
                          <div className="absolute -top-4 left-0 right-0 h-6">
                            {chordPlacements
                              .filter(p => p.line_index === lineIndex)
                              .map((placement, index) => {
                                const chordName = placement.chord
                                const position = placement.chord_position !== undefined ? placement.chord_position + 1 : ''

                                return (
                                  <div
                                    key={index}
                                    className="absolute transform -translate-x-1/2 group cursor-pointer"
                                    style={{ left: `${placement.position}%` }}
                                    onMouseEnter={(e) => {
                                      setHoveredChord({ chord: chordName, position: placement.chord_position ?? 0, lineIndex, placementIndex: index })
                                      setTooltipPosition({ x: e.clientX, y: e.clientY })
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredChord(null)
                                      setTooltipPosition(null)
                                    }}
                                  >
                                    <div className="rounded px-2 py-1 text-xs font-medium shadow-sm bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200">
                                      <span className="font-mono">{chordName}</span>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>

                          {/* Lyrics text */}
                          <div
                            className={`text-lg pt-2 cursor-pointer hover:bg-background/30 hover:underline rounded px-2 py-1 transition-colors ${lineIndex === currentLyricIndex && currentLyricIndex !== -1
                              ? "text-blue font-bold"
                              : lineIndex === clickedLineIndex
                                ? "text-black font-bold"
                                : "text-gray-500"
                              }`}
                            onClick={() => handleLyricClick(lineIndex)}
                            title={`Click to jump to ${Math.floor(line.timestamp / 1000)}s`}
                          >
                            {line.text?.trim() || <em> * instrumental * </em>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div ref={lyricsContainerRef} className="max-h-64 overflow-y-auto overflow-x-visible space-y-6 pr-2">
                    {lyricData.map((line: any, lineIndex: number) => (
                      <div
                        key={lineIndex}
                        ref={lineIndex === currentLyricIndex ? currentLineRef : null}
                        className="p-4 bg-background/50 rounded-md"
                      >
                        {/* Chord selectors and text container */}
                        <div className="relative min-h-[2.5rem]">
                          {/* Display chords */}
                          <div className="absolute -top-4 left-0 right-0 h-6">
                            {chordPlacements
                              .filter(p => p.line_index === lineIndex)
                              .map((placement, index) => {
                                const chordName = placement.chord
                                const position = placement.chord_position !== undefined ? placement.chord_position + 1 : ''

                                return (
                                  <div
                                    key={index}
                                    className="absolute transform -translate-x-1/2 group cursor-pointer"
                                    style={{ left: `${placement.position}%` }}
                                    onMouseEnter={(e) => {
                                      setHoveredChord({ chord: chordName, position: placement.chord_position ?? 0, lineIndex, placementIndex: index })
                                      setTooltipPosition({ x: e.clientX, y: e.clientY })
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredChord(null)
                                      setTooltipPosition(null)
                                    }}
                                  >
                                    <div className="rounded px-2 py-1 text-xs font-medium shadow-sm bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200">
                                      <span className="font-mono">{chordName}</span>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>

                          {/* Lyrics text */}
                          <div
                            className={`text-lg pt-2 cursor-pointer hover:bg-background/30 hover:underline rounded px-2 py-1 transition-colors ${lineIndex === currentLyricIndex && currentLyricIndex !== -1
                              ? "text-blue font-bold"
                              : lineIndex === clickedLineIndex
                                ? "text-black font-bold"
                                : "text-gray-500"
                              }`}
                            onClick={() => handleLyricClick(lineIndex)}
                            title={`Click to jump to ${Math.floor(line.timestamp / 1000)}s`}
                          >
                            {line.text?.trim() || <em> * instrumental * </em>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Loading lyrics...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Tooltip Container */}
      {hoveredChord && tooltipPosition && (
        <div
          className="fixed pointer-events-none z-[99999] opacity-100 transition-opacity duration-200"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y - 20,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center min-h-[80px]">
              <div className="text-[10px] text-gray-500 dark:text-gray-500 mb-1">
                Position {hoveredChord.position + 1}
              </div>
              <div className="flex items-center justify-center">
                <ChordDiagram
                  chord={getChordData(hoveredChord.chord)?.[hoveredChord.position] || { frets: [], fingers: [], barres: [], capo: false }}
                  size={120}
                />
              </div>
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-800"></div>
          </div>
        </div>
      )}
    </main>
  )
}
