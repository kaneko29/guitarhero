'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
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

export interface SpotifyPlayerRef {
  cleanup: () => Promise<void>
  seek: (position: number) => Promise<void>
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

// Global state to track SDK loading
let sdkLoadingPromise: Promise<void> | null = null
let sdkLoaded = false

// Function to load Spotify SDK once
const loadSpotifySDK = (): Promise<void> => {
  if (sdkLoaded) {
    return Promise.resolve()
  }

  if (sdkLoadingPromise) {
    return sdkLoadingPromise
  }

  sdkLoadingPromise = new Promise((resolve, reject) => {
    // Check if SDK is already available
    if (window.Spotify) {
      sdkLoaded = true
      resolve()
      return
    }

    // Check if script is already loading
    const existingScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')
    if (existingScript) {
      // Wait for the existing script to load
      const checkSDK = () => {
        if (window.Spotify) {
          sdkLoaded = true
          resolve()
        } else {
          setTimeout(checkSDK, 100)
        }
      }
      checkSDK()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true

    script.onerror = () => {
      sdkLoadingPromise = null
      reject(new Error('Failed to load Spotify Web Playback SDK'))
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkLoaded = true
      sdkLoadingPromise = null
      resolve()
    }

    document.body.appendChild(script)
  })

  return sdkLoadingPromise
}

export default forwardRef<SpotifyPlayerRef, Props>(function SpotifyPlayer({ trackUri, onPositionChange }, ref) {
  const { data: session, status } = useSession()
  const [player, setPlayer] = useState<any>(null)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const playerRef = useRef<any>(null)
  const pathname = usePathname()
  const previousPathRef = useRef(pathname)
  const initializationRef = useRef(false)
  const initialLoadRef = useRef(true)

  // Expose cleanup function to parent
  useImperativeHandle(ref, () => ({
    cleanup: () => cleanup(true),
    seek: async (position: number) => {
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
  }), [player, session?.accessToken])

  // Cleanup function
  const cleanup = async (shouldDisconnect = true) => {
    console.log('Cleaning up Spotify player...', { shouldDisconnect, hasPlayer: !!playerRef.current, isReady })

    // Clear any intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Stop playback before disconnecting
    if (session?.accessToken && shouldDisconnect) {
      try {
        console.log('Attempting to stop playback...')

        // Check if player is currently playing
        if (playerRef.current) {
          try {
            const currentState = await playerRef.current.getCurrentState()
            console.log('Current player state:', currentState)

            if (currentState && !currentState.paused) {
              console.log('Player is playing, attempting to pause...')
              await playerRef.current.pause()
              console.log('Playback stopped via player instance')
            } else {
              console.log('Player is already paused or no state')
            }
          } catch (playerErr) {
            console.log('Could not get player state, trying API...', playerErr)
            // Fallback to API call
            await fetch('https://api.spotify.com/v1/me/player/pause', {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${session.accessToken}`
              }
            })
            console.log('Playback stopped via API')
          }
        } else {
          console.log('No player instance, using API to stop playback')
          // Stop playback completely via API
          await fetch('https://api.spotify.com/v1/me/player/pause', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.accessToken}`
            }
          })
          console.log('Playback stopped during cleanup')
        }

        // Wait a moment for the stop to take effect
        await new Promise(resolve => setTimeout(resolve, 500))

        // Double-check that playback is stopped
        if (playerRef.current) {
          try {
            const finalState = await playerRef.current.getCurrentState()
            console.log('Final player state after cleanup:', finalState)
          } catch (err) {
            console.log('Could not get final state')
          }
        }
      } catch (err) {
        console.error('Error stopping playback during cleanup:', err)
      }
    }

    // Clean up player instance
    if (playerRef.current && shouldDisconnect) {
      try {
        console.log('Disconnecting player...')
        playerRef.current.removeListener('player_state_changed')
        playerRef.current.removeListener('ready')
        playerRef.current.removeListener('not_ready')
        playerRef.current.removeListener('initialization_error')
        playerRef.current.removeListener('authentication_error')
        playerRef.current.removeListener('account_error')
        playerRef.current.removeListener('playback_error')
        await playerRef.current.disconnect()
        console.log('Player disconnected')
      } catch (err) {
        console.error('Error during player cleanup:', err)
      }
      playerRef.current = null
    }

    // Reset all state
    setPlayer(null)
    setCurrentTrack(null)
    setPlaybackState(null)
    setDeviceId(null)
    setIsReady(false)
    setIsInitializing(false)
    initializationRef.current = false
    initialLoadRef.current = true
  }

  // Handle path changes
  useEffect(() => {
    console.log('Path changed:', { previous: previousPathRef.current, current: pathname })
    if (previousPathRef.current !== pathname) {
      console.log('Navigating within app, cleaning up player...')
      // Use an async function to ensure cleanup completes
      const handleNavigation = async () => {
        await cleanup(true) // Disconnect when navigating within the app
        previousPathRef.current = pathname
      }
      handleNavigation()
    }
  }, [pathname])

  // Handle navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Don't disconnect on beforeunload - this prevents issues when switching tabs
      // The player will naturally disconnect when the page is actually unloaded
      console.log('Page unloading, but keeping player connected for tab switches')
    }

    const handleVisibilityChange = () => {
      // Don't cleanup when tab becomes hidden/visible
      // This prevents disconnection when switching tabs
      console.log('Page visibility changed:', document.visibilityState)

      // If page becomes visible again and we have a player but it's not ready,
      // try to reconnect
      if (document.visibilityState === 'visible' && playerRef.current && !isReady) {
        console.log('Page became visible, checking player state...')
        // Try to get current state to see if player is still connected
        playerRef.current.getCurrentState().then((state: any) => {
          if (state) {
            console.log('Player is still connected, updating state')
            setPlaybackState(state)
            setCurrentTrack(state.track_window.current_track)
            setIsReady(true)
          } else {
            console.log('Player lost connection, attempting to reconnect...')
            // Player lost connection, try to reconnect
            initializationRef.current = false
            setIsReady(false)
          }
        }).catch((error: any) => {
          console.log('Error getting player state, attempting to reconnect...', error)
          initializationRef.current = false
          setIsReady(false)
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [session])

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      console.log('Not authenticated or no access token:', { status, hasToken: !!session?.accessToken })
      cleanup()
      return
    }

    // Prevent multiple initializations
    if (initializationRef.current || isInitializing) {
      return
    }

    initializationRef.current = true
    setIsInitializing(true)

    const initializePlayer = async () => {
      try {
        console.log('Loading Spotify Web Playback SDK...')
        await loadSpotifySDK()

        console.log('Creating Spotify player...')
        const spotifyPlayer = new window.Spotify.Player({
          name: 'Guitar Hero Chord App',
          getOAuthToken: (cb: (token: string) => void) => {
            console.log('Getting OAuth token...')
            cb(session.accessToken!)
          },
          volume: 0.5
        })

        // Ready
        spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
          console.log('Ready with Device ID', device_id)
          setDeviceId(device_id)
          setIsReady(true)
          setIsInitializing(false)

          if (trackUri && session?.accessToken) {
            console.log('Setting up track playback...')
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
              console.log('Device set as active')
              return fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${session.accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  uris: [trackUri],
                }),
              })
            }).then(() => {
              console.log('Track queued for playback')
              return fetch('https://api.spotify.com/v1/me/player/pause', {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${session.accessToken}`
                }
              })
            }).then(() => {
              console.log('Track playback initialized')
              // Get initial state after setup
              return spotifyPlayer.getCurrentState()
            }).then((state) => {
              if (state) {
                setPlaybackState(state)
                setCurrentTrack(state.track_window.current_track)
              }
            }).catch((err) => {
              console.error('Error setting up track playback:', err)
              setIsReady(false)
            })
          }
        })

        spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
          console.log('Device ID has gone offline', device_id)
          setIsReady(false)
        })

        spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
          console.error('Failed to initialize Spotify player:', message)
          setIsReady(false)
          setIsInitializing(false)
        })

        spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
          console.error('Failed to authenticate with Spotify:', message)
          setIsReady(false)
          setIsInitializing(false)
        })

        spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
          console.error('Failed to validate Spotify account:', message)
          setIsReady(false)
          setIsInitializing(false)
        })

        spotifyPlayer.addListener('playback_error', ({ message }: { message: string }) => {
          console.error('Failed to perform playback:', message)
          setIsReady(false)
        })

        spotifyPlayer.addListener('player_state_changed', (state: PlaybackState) => {
          if (!state) return
          setCurrentTrack(state.track_window.current_track)
          setPlaybackState(state)
        })

        console.log('Connecting to Spotify...')
        await spotifyPlayer.connect()
        console.log('Successfully connected to Spotify')

        setPlayer(spotifyPlayer)
        playerRef.current = spotifyPlayer
      } catch (error: any) {
        console.error('Failed to initialize Spotify player:', error)
        setIsReady(false)
        setIsInitializing(false)
        initializationRef.current = false
      }
    }

    initializePlayer()

    return () => {
      // Don't disconnect on component unmount - this prevents issues when React
      // unmounts components during development or other non-navigation scenarios
      console.log('Component unmounting, but keeping player connected')

      // However, we should still try to stop playback when the component unmounts
      if (session?.accessToken) {
        console.log('Stopping playback on component unmount...')
        fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        }).catch(err => {
          console.error('Error stopping playback on unmount:', err)
        })
      }
    }
  }, [session, status, trackUri])

  // Handle trackUri changes after player is ready
  useEffect(() => {
    if (isReady && trackUri && session?.accessToken && deviceId && !initialLoadRef.current) {
      console.log('Track URI changed, updating playback...')
      fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false
        })
      }).then(() => {
        console.log('Device set as active for new track')
        return fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [trackUri],
          }),
        })
      }).then(() => {
        console.log('New track queued for playback')
        return fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        })
      }).then(() => {
        console.log('New track playback initialized')
        // Get initial state after setup
        if (player) {
          return player.getCurrentState()
        }
      }).then((state) => {
        if (state) {
          setPlaybackState(state)
          setCurrentTrack(state.track_window.current_track)
        }
      }).catch((err) => {
        console.error('Error updating track playback:', err)
      })
    }
  }, [trackUri, isReady, session?.accessToken, deviceId, player])

  // Mark initial load as complete when player is ready
  useEffect(() => {
    if (isReady) {
      initialLoadRef.current = false
    }
  }, [isReady])

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

  const togglePlay = async () => {
    if (!player || !session?.accessToken) return

    try {
      if (playbackState?.paused) {
        // Resume playback
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_ids: [deviceId],
          }),
        })
      } else {
        // Pause playback
        await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
          },
        })
      }

      // Get updated state
      const state = await player.getCurrentState()
      if (state) {
        setPlaybackState(state)
      }
    } catch (error) {
      console.error('Error toggling playback:', error)
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

  const seekForward = async () => {
    if (!player || !playbackState || !session?.accessToken) return
    const newPosition = Math.min(playbackState.position + 10000, playbackState.duration)
    await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(newPosition)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })
    const newState = await player.getCurrentState()
    if (newState) {
      setPlaybackState(newState)
    }
  }

  const seekBackward = async () => {
    if (!player || !playbackState || !session?.accessToken) return
    const newPosition = Math.max(playbackState.position - 10000, 0)
    await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(newPosition)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })
    const newState = await player.getCurrentState()
    if (newState) {
      setPlaybackState(newState)
    }
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

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Initializing player...</p>
        </div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Connecting to Spotify...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
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
            className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary hover:bg-opacity-90 transition-colors"
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
              onChange={async (position: number) => {
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
              }}
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
    </div>
  )
})