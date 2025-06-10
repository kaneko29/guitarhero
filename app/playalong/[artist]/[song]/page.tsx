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

        if (songError && songError.code === 'PGRST116') {
          setError('Song not found')
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
        setLyricData(lyrics)
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

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="p-6">
        <button
          onClick={handleBack}
          className="inline-block mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          ← Back
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <h1 className="text-4xl font-bold text-blue-600 mb-6 text-center capitalize">
          {decodedSong}
        </h1>

        <h2 className="text-2xl text-gray-600 mb-6 text-center capitalize">
          by {decodedArtist}
        </h2>

        {song?.spotifyId && (
          <div className="w-full max-w-2xl mx-auto mb-8">
            <SpotifyPlayer uri={`spotify:track:${song.spotifyId}`} />
          </div>
        )}

        <LyricsDisplay lyricData={lyricData} currentLyricIndex={currentLyricIndex} />
      </div>
    </main>
  )
}
