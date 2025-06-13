'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { ChordGrid } from '../../../components/ChordGrid'
import { getSyncedLyrics } from '@/lib/lrclib'
import { parseLrcFile } from '@/lib/lrcParser'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { WordTiming, Song } from '@/lib/types'

import { useUser, useUserLoading } from '@/app/providers/UserProvider'

import SpotifyPlayer from '../../../components/SpotifyPlayer'
import LyricsDisplay from '@/app/components/LyricsDisplay'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, Music, AlertCircle } from 'lucide-react'

type Props = {
  params: Promise<{
    artist: string
    song: string
  }>
}

async function getProcessedLyrics(artist: string, title: string, savedChords?: any) {
  const lrcContent = await getSyncedLyrics(artist, title)
  if (!lrcContent) return null
  const parsed = parseLrcFile(lrcContent)

  // Process each line to compute words and add chord associations from saved data
  parsed.lyrics = parsed.lyrics.map((line, lineIndex) => {
    if (!line.text) return line

    // Split the line into words
    const words = line.text.split(/\s+/).filter(word => word.length > 0)

    // Create word timings with equal distribution of time
    const duration = (line.endTimestamp || line.timestamp + 3000) - line.timestamp
    const wordDuration = duration / words.length

    const wordTimings: WordTiming[] = words.map((word, wordIndex) => {
      const start = line.timestamp + (wordIndex * wordDuration)
      const end = start + wordDuration

      // Use saved chord data if available
      let chord: string | undefined
      if (savedChords && savedChords[lineIndex]?.words?.[wordIndex]?.chord) {
        chord = savedChords[lineIndex].words[wordIndex].chord
      }

      return {
        word,
        start,
        end,
        chord
      }
    })

    return {
      ...line,
      words: wordTimings
    }
  })

  return parsed.lyrics
}

const pausePlayback = async (accessToken: string) => {
  try {
    await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    console.log('Playback paused.')
  } catch (err) {
    console.error('Failed to pause playback:', err)
  }
}

export default function SongPage({ params }: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [lyricData, setLyricData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedChords, setSavedChords] = useState<any>(null)

  const { artist, song } = use(params)
  const decodedArtist = decodeURIComponent(artist)
  const decodedSong = decodeURIComponent(song)

  const searchParams = useSearchParams()
  const uri = searchParams.get('uri')
  const versionId = searchParams.get('version')

  const { data: session } = useSession()

  const normalizeSongName = (name: string): string =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '')

  const user = useUser()
  const loading = useUserLoading()
  const router = useRouter()

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
          setSongs([songData])
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
          setSavedChords(null)
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
          setSavedChords(null)
          return
        }

        if (songError) throw songError

        if (songData) {
          // Get the specific version if provided, otherwise get the most recent
          const query = supabase
            .from('song_edits')
            .select('lyrics')
            .eq('song_id', songData.id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (versionId) {
            query.eq('id', versionId)
          }

          const { data: editData, error: editError } = await query.single()

          // If no edits found, just continue without chords
          if (editError && editError.code === 'PGRST116') {
            setSavedChords(null)
            return
          }

          if (editError) throw editError

          if (editData) {
            setSavedChords(editData.lyrics)
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

  // Load synced lyrics with saved chords
  useEffect(() => {
    const loadLyrics = async () => {
      try {
        const lyrics = await getProcessedLyrics(decodedArtist, decodedSong, savedChords)
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
  }, [decodedArtist, decodedSong, savedChords])

  useEffect(() => {
    if (!lyricData || !Array.isArray(lyricData)) return;

    const index = lyricData.findIndex(
      (line: { timestamp: number; endTimestamp: number }) =>
        playbackPosition >= line.timestamp && playbackPosition < line.endTimestamp
    );

    setCurrentLyricIndex(index);
  }, [playbackPosition, lyricData]);

  const handleBack = () => {
    router.back()
  }

  // Extract unique chord names from lyrics
  const chordNames: string[] = lyricData
    ? Array.from(
      new Set(
        lyricData
          .flatMap((line: any) => line.words || [])
          .map((word: WordTiming) => word.chord)
          .filter((chord: string | undefined): chord is string => typeof chord === 'string')
      )
    ) as string[]
    : []

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
          </div>

          {/* Player and Lyrics Section */}
          <div className="grid gap-8">
            {/* Spotify Player */}
            <div className="bg-card border border-border rounded-lg p-6">
              <SpotifyPlayer
                trackUri={uri || ''}
                onPositionChange={setPlaybackPosition}
              />
            </div>

            {/* Lyrics Display */}
            <div className="bg-card border border-border rounded-lg p-6">
              {lyricData ? (
                <LyricsDisplay
                  lyricData={lyricData}
                  currentLyricIndex={currentLyricIndex}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Loading lyrics...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Chord Grid */}
            {savedChords && chordNames.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <ChordGrid chordNames={chordNames} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
