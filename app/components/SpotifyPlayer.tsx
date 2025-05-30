'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { SpotifyAuthButton } from './SpotifyAuthButton'
import { SeekBar } from './SeekBar'

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

export default function SpotifyPlayer({ trackUri, onPositionChange}: Props) {
  const { data: session, status } = useSession()
  const [player, setPlayer] = useState<any>(null)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return

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
      
        // 👇 Auto-transfer playback to this device and start song
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
              // Pause immediately
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
            // Not Ready
      spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device ID has gone offline', device_id)
        setIsReady(false)
      })

      // Player state changed
      spotifyPlayer.addListener('player_state_changed', (state: PlaybackState) => {
        if (!state) return
        
        setCurrentTrack(state.track_window.current_track)
        setPlaybackState(state)
        
        // This is where you'll sync with your chord data!
        console.log('Current position (ms):', state.position)
      })

      spotifyPlayer.connect()
      setPlayer(spotifyPlayer)
    }

    return () => {
      if (player) {
        player.disconnect()
      }
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
        // TODO: Here's where you'll trigger chord changes based on position
        console.log('Syncing chords at position:', state.position)
      }
    }, 500) // Update every 500ms for smooth chord transitions

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [player, playbackState])
  // Control functions
  const togglePlay = () => {
    if (player) {
      player.togglePlay()
    }
  }



  const skipPrevious = async () => {
    if (!player) return
  
    await player.previousTrack()
  
    // 🧠 Immediately update playback state
    const newState = await player.getCurrentState()
    if (newState) {
      setPlaybackState(newState)
    }
  }
  

  // New seek function
  const handleSeek = async (position: number) => {
    if (!player || !session?.accessToken) return
  
    try {
      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(position)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      })
  
      // 🧠 Force-update the UI immediately after seek
      const newState = await player.getCurrentState()
      if (newState) {
        setPlaybackState(newState)
      }
  
    } catch (error) {
      console.error('Error seeking:', error)
    }
  }
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
    <div className="p-4 max-w-md mx-auto bg-gray rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
      </div>

      {!isReady && (
        <div className="text-center py-4">
          <p className="text-gray-600">Connecting to Spotify...</p>
        </div>
      )}

      {currentTrack && (
        <>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="flex items-center space-x-3">
              <img 
                src={currentTrack.album.images[0]?.url} 
                alt={currentTrack.album.name}
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl shadow-lg"
                />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate text-lg sm:text-xl">{currentTrack.name}</h3>
                <p className="text-gray-600 text-sm sm:text-base truncate">
                  {currentTrack.artists[0]?.name}
                </p>
              </div>
            </div>
            
            {playbackState && (
              <div className="mt-4 sm:mt-6 px-2 sm:px-4">
                <SeekBar
                  currentPosition={playbackState.position}
                  duration={playbackState.duration}
                  onSeek={handleSeek}
                />
              </div>
            )}
          </div>

          <div className="flex justify-center space-x-6 mt-6">
            <button 
              onClick={skipPrevious}
              className="bg-gray-300 hover:bg-gray-400 p-4 sm:p-5 rounded-full text-2xl"
            >
              ⏮️
            </button>
            <button 
              onClick={togglePlay}
              className="bg-blue-500 hover:bg-blue-600 text-white p-4 sm:p-5 rounded-full text-2xl"
            >
              {playbackState?.paused ? '▶️' : '⏸️'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
