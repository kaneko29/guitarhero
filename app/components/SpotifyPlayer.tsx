'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { SpotifyAuthButton } from './SpotifyAuthButton'
import { SeekBar } from './SeekBar'

// Create a singleton player instance
let spotifyPlayerInstance: any = null

interface SpotifyTrack {
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string }>
  }
}

interface Props {
  trackUri?: string
  onPositionChange?: (position: number) => void
}

interface PlaybackState {
  position: number
  duration: number
  paused: boolean
  track_window: {
    current_track: SpotifyTrack
  }
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: {
      Player: new (options: any) => any
    }
  }
}

export default function SpotifyPlayer({ trackUri, onPositionChange }: Props) {
  const { data: session, status } = useSession()
  const [player, setPlayer] = useState<any>(spotifyPlayerInstance)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || initializedRef.current) return

    // If we already have a player instance, just reconnect
    if (spotifyPlayerInstance) {
      spotifyPlayerInstance.connect()
      setPlayer(spotifyPlayerInstance)
      setIsReady(true)
      initializedRef.current = true
      return
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Guitar Hero Chord App',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(session.accessToken!)
        },
        volume: 0.5
      })

      // Ready
      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Ready with Device ID', device_id)
        setDeviceId(device_id)
        setIsReady(true)
        initializedRef.current = true

        if (trackUri && session?.accessToken) {
          fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              device_ids: [device_id],
              play: false
            })
          }).then(() => {
            fetch('https://api.spotify.com/v1/me/player/play', {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                uris: [trackUri],
              }),
            })
              .then(() => {
                return fetch('https://api.spotify.com/v1/me/player/pause', {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${session.accessToken}`
                  }
                })
              })
          }).then(() => {
            console.log('Track playback started on Web SDK')
          }).catch(err => {
            console.error('Error playing track on Web SDK:', err)
          })
        }
      })

      spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device ID has gone offline', device_id)
        setIsReady(false)
      })

      spotifyPlayer.addListener('player_state_changed', (state: PlaybackState) => {
        if (!state) return
        setCurrentTrack(state.track_window.current_track)
        setPlaybackState(state)
        console.log('Current position (ms):', state.position)
      })

      spotifyPlayer.connect()
      setPlayer(spotifyPlayer)
      spotifyPlayerInstance = spotifyPlayer
    }

    return () => {
      // Don't disconnect the player on component unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [session, status])

  // Poll for playback position updates
  useEffect(() => {
    if (!player || !playbackState || playbackState.paused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      return
    }

    intervalRef.current = setInterval(async () => {
      const state = await player.getCurrentState()
      if (state) {
        setPlaybackState(state)
        if (onPositionChange) {
          onPositionChange(state.position)
        }
      }
    }, 500)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [player, playbackState])

  const togglePlay = () => {
    if (player) {
      player.togglePlay()
    }
  }

  const skipPrevious = async () => {
    if (!player) return
    await player.previousTrack()
    const newState = await player.getCurrentState()
    if (newState) {
      setPlaybackState(newState)
    }
  }

  const handleSeek = async (position: number) => {
    if (!player || !session?.accessToken) return
    try {
      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(position)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      })
      const newState = await player.getCurrentState()
      if (newState) {
        setPlaybackState(newState)
      }
    } catch (error) {
      console.error('Error seeking:', error)
    }
  }

  const seekForward = async () => {
    if (!player || !playbackState || !session?.accessToken) return
    const newPosition = Math.min(playbackState.position + 10000, playbackState.duration)
    await handleSeek(newPosition)
  }

  const seekBackward = async () => {
    if (!player || !playbackState || !session?.accessToken) return
    const newPosition = Math.max(playbackState.position - 10000, 0)
    await handleSeek(newPosition)
  }

  // Add keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard events if the player is ready and we have a track
      if (!isReady || !currentTrack) return

      switch (event.code) {
        case 'Space':
          event.preventDefault() // Prevent page scroll
          togglePlay()
          break
        case 'ArrowRight':
          event.preventDefault()
          seekForward()
          break
        case 'ArrowLeft':
          event.preventDefault()
          seekBackward()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isReady, currentTrack, player, playbackState])

  if (status === 'loading') {
    return <div className="p-4">Loading...</div>
  }

  if (status !== 'authenticated') {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold mb-4">Connect to Spotify</h2>
        <p className="mb-4 text-gray-600">
          Connect your Spotify account to play songs and see chords in real-time
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-6 mb-8">
      {!isReady && (
        <div className="text-center py-4">
          <p className="text-gray-600">Connecting to Spotify...</p>
        </div>
      )}

      {currentTrack && (
        <>
          <img
            src={currentTrack.album.images[0]?.url}
            alt={currentTrack.album.name}
            className="w-32 h-32 rounded-xl shadow-lg"
          />

          <div className="flex flex-col gap-3">
            {playbackState && (
              <div className="w-64">
                <SeekBar
                  currentPosition={playbackState.position}
                  duration={playbackState.duration}
                  onSeek={handleSeek}
                />
              </div>
            )}

            <div className="flex justify-center space-x-4">
              <button
                onClick={skipPrevious}
                className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full text-lg transition-colors"
                title="Previous Track"
              >
                ⏮️
              </button>
              <button
                onClick={togglePlay}
                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full text-lg transition-colors"
                title="Play/Pause (Space)"
              >
                {playbackState?.paused ? '▶️' : '⏸️'}
              </button>
              <button
                onClick={seekBackward}
                className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full text-lg transition-colors"
                title="Back 10s (←)"
              >
                ⏪
              </button>
              <button
                onClick={seekForward}
                className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full text-lg transition-colors"
                title="Forward 10s (→)"
              >
                ⏩
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
