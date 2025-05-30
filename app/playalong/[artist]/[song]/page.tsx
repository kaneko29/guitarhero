'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { ChordGrid } from '../../../components/ChordGrid'
import { getSyncedLyrics } from '@/lib/lrclib'
import { parseLrcFile } from '@/lib/lrcParser'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

import SpotifyPlayer from '../../../components/SpotifyPlayer'
import { SpotifyAuthButton } from '@/app/components/SpotifyAuthButton'
import LyricsDisplay from '@/app/components/LyricsDisplay'



const songChordMap: Record<string, string[]> = {
  'let-it-be': ['C', 'G', 'Am', 'F'],
  'stand-by-me': ['G', 'Em', 'C', 'D', 'F', 'Am'],
  'wonderwall': ['Em', 'G', 'D', 'A7sus4', 'F#'],
  'mary': ['Em', 'G', 'Bm', 'C', 'Cmaj7', 'Gmaj7']
}

type Props = {
  params: Promise<{
    artist: string
    song: string
  }>
}

async function getProcessedLyrics(artist: string, title: string) {
  const lrcContent = await getSyncedLyrics(artist, title)
  if (!lrcContent) return null
  const parsed = parseLrcFile(lrcContent)
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
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [lyricData, setLyricData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)


  const { artist, song } = use(params)
  const decodedArtist = decodeURIComponent(artist)
  const decodedSong = decodeURIComponent(song)

    // 🎤 Load synced lyrics
    useEffect(() => {
        const loadLyrics = async () => {
          try {
            const lyrics = await getProcessedLyrics(decodedArtist, decodedSong)
            setLyricData(lyrics)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
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
      }, [playbackPosition, lyricData]);
          

  const searchParams = useSearchParams()
  const uri = searchParams.get('uri')

  const { data: session } = useSession()

  const normalizeSongName = (name: string): string =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '')

  const matchingSongKey = Object.keys(songChordMap).find(
    key => normalizeSongName(key) === normalizeSongName(decodedSong)
  )

  const chordNames = matchingSongKey ? songChordMap[matchingSongKey] : null

  const router = useRouter()
  
  const handleBack = async () => {
    if (session?.accessToken) {
        await pausePlayback(session.accessToken)
    }
    router.push('/')
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

        <h1 className="text-4xl font-bold text-blue-600 mb-6 text-center capitalize">
          {matchingSongKey?.replace(/-/g, ' ') || decodedSong}
        </h1>

        <h2 className="text-2xl text-gray-600 mb-6 text-center capitalize">
          by {decodedArtist}
        </h2>

        {chordNames && <ChordGrid chordNames={chordNames} />}

        <SpotifyAuthButton 
        className="fixed top-4 right-4 z-50"
        size="sm"
        />
            <LyricsDisplay
  lyricData={lyricData}
  currentLyricIndex={currentLyricIndex}
  />
    <SpotifyPlayer 
        trackUri={uri || undefined} 
        onPositionChange={setPlaybackPosition}
        />
    


      </div>
    </main>
  )
}
