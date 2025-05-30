'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'

interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string }>
  }
  duration_ms: number
  uri: string
  preview_url: string | null
}

interface SearchResponse {
  tracks: {
    items: SpotifyTrack[]
  }
}

export default function SpotifySearch() {
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyTrack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const searchTracks = async (searchQuery: string) => {
    if (!session?.accessToken || !searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data: SearchResponse = await response.json()
      setResults(data.tracks.items)
    } catch (err) {
      setError('Failed to search tracks. Please try again.')
      console.error('Search error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchTracks(query)
  }

  const playTrack = async (trackUri: string) => {
    if (!session?.accessToken) return

    try {
      await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: [trackUri],
        }),
      })
    } catch (err) {
      console.error('Error playing track:', err)
    }
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!session) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600">Sign in with Spotify to search for songs</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for songs, artists, or albums..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-2">
        {results.map((track) => (
          <div
            key={track.id}
            className="flex items-center space-x-4 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {/* Album Art */}
            <img
              src={track.album.images[2]?.url || track.album.images[0]?.url}
              alt={track.album.name}
              className="w-12 h-12 rounded"
            />

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{track.name}</h3>
              <p className="text-gray-600 text-sm truncate">
                {track.artists.map(artist => artist.name).join(', ')}
              </p>
              <p className="text-gray-500 text-xs truncate">
                {track.album.name} • {formatDuration(track.duration_ms)}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {/* Preview Button (if available) */}
              {track.preview_url && (
                <button
                  onClick={() => {
                    const audio = new Audio(track.preview_url!)
                    audio.play()
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                  title="Preview (30s)"
                >
                  🔊
                </button>
              )}


              {/* Play Button 
              <button
                onClick={() => playTrack(track.uri)}
                className="px-3 py-1 text-sm bg-green-500 text-white hover:bg-green-600 rounded"
                title="Play on Spotify"
              >
                ▶️ Play
              </button>
              */}

              {/* Link to Chord Page */}
              <button
                onClick={() => {
                  // This would navigate to your chord page
                  const artist = encodeURIComponent(track.artists[0].name.trim())
                  const title = encodeURIComponent(track.name.trim())
                  const trackUriEncoded = encodeURIComponent(track.uri)
                  window.location.href = `/playalong/${artist}/${title}?uri=${trackUriEncoded}`
                }}
                className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
                title="View chords"
              >
                🎸 Chords
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {query && !isLoading && results.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500">
          No results found for "{query}"
        </div>
      )}
    </div>
  )
}
