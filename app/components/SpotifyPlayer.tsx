'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { SpotifyAuthButton } from './SpotifyAuthButton'
import { SeekBar } from './SeekBar'
import { Play, Pause, SkipBack, SkipForward, Music, Volume2, VolumeX } from 'lucide-react'
import { usePathname } from 'next/navigation'

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

// Add this helper function at the top level
const formatTime = (ms: number): string => {
  if (!ms || isNaN(ms)) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function SpotifyPlayer({ trackUri, onPositionChange }: Props) {
  const { data: session, status } = useSession()
  const [player, setPlayer] = useState<any>(null)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const playerRef = useRef<any>(null)
  const shouldReinitializeRef = useRef(true)
  const pathname = usePathname()
  const previousPathRef = useRef(pathname)

  // Cleanup function
  const cleanup = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Stop playback first
    if (session?.accessToken) {
      try {
        await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        })
      } catch (err) {
        console.error('Error pausing playback:', err)
      }
    }

    if (playerRef.current) {
      playerRef.current.removeListener('player_state_changed')
      playerRef.current.removeListener('ready')
      playerRef.current.removeListener('not_ready')
      playerRef.current.disconnect()
      playerRef.current = null
    }

    setPlayer(null)
    setCurrentTrack(null)
    setPlaybackState(null)
    setDeviceId(null)
    setIsReady(false)
  }

  // Handle path changes
  useEffect(() => {
    if (previousPathRef.current !== pathname) {
      cleanup()
      shouldReinitializeRef.current = true
      previousPathRef.current = pathname
    }
  }, [pathname])

  // Handle navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanup()
      shouldReinitializeRef.current = true
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [session])

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      cleanup()
      return
    }

    // If we shouldn't reinitialize, just return
    if (!shouldReinitializeRef.current) {
      return
    }

    // Reset the flag after checking
    shouldReinitializeRef.current = false

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
      })

      spotifyPlayer.connect()
      setPlayer(spotifyPlayer)
      playerRef.current = spotifyPlayer
    }

    return () => {
      cleanup()
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [session, status, trackUri])

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
  }, [player, playbackState, onPositionChange])

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
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Loading player...</p>
        </div>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="text-center space-y-4">
          <Music className="h-12 w-12 text-primary mx-auto" />
          <h3 className="text-lg font-medium text-foreground">Connect to Spotify</h3>
          <p className="text-muted-foreground">Sign in to Spotify to play music</p>
          <SpotifyAuthButton />
        </div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Initializing player...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {status === 'loading' ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
            <p className="text-muted-foreground">Loading player...</p>
          </div>
        </div>
      ) : !session ? (
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Sign in to Spotify to play music</p>
          <SpotifyAuthButton />
        </div>
      ) : !isReady ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
            <p className="text-muted-foreground">Connecting to Spotify...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Track Info */}
          {currentTrack && (
            <div className="flex items-center gap-4">
              {currentTrack.album.images[0] && (
                <img
                  src={currentTrack.album.images[0].url}
                  alt={currentTrack.name}
                  className="w-16 h-16 rounded-md object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{currentTrack.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {currentTrack.artists.map(artist => artist.name).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={skipPrevious}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={seekBackward}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            >
              {playbackState?.paused ? (
                <Play className="h-6 w-6" />
              ) : (
                <Pause className="h-6 w-6" />
              )}
            </button>
            <button
              onClick={seekForward}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            <button
              onClick={skipPrevious}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Bar */}
          {playbackState && (
            <div className="space-y-2">
              <SeekBar
                value={playbackState.position}
                max={playbackState.duration}
                onChange={handleSeek}
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formatTime(playbackState.position)}</span>
                <span>{formatTime(playbackState.duration)}</span>
              </div>
            </div>
          )}

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (player) {
                  const currentVolume = player.getVolume()
                  if (currentVolume > 0) {
                    player.setVolume(0)
                  } else {
                    player.setVolume(0.5)
                  }
                }
              }}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
            >
              {player?.getVolume() === 0 ? (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Volume2 className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <div className="flex-1 max-w-[100px]">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                defaultValue="0.5"
                onChange={(e) => {
                  if (player) {
                    player.setVolume(parseFloat(e.target.value))
                  }
                }}
                className="w-full h-1 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
