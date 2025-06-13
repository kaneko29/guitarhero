'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Music } from 'lucide-react'

interface SpotifyTrack {
  name: string
  artists: { name: string }[]
  uri: string
  album: {
    images: { url: string }[]
  }
}

export default function SpotifySearch() {
  const { data: session, status } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    if (!session?.accessToken) {
      console.error('No access token available')
      return
    }

    setIsSearching(true)
    try {
      console.log('Searching for:', searchQuery)
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`
        }
      })
      console.log('Search response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Search API error:', errorText)
        throw new Error(`Search failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Search response data:', JSON.stringify(data, null, 2))

      if (!data || !data.tracks || !Array.isArray(data.tracks.items)) {
        console.error('Invalid search response format:', data)
        setSearchResults([])
        return
      }

      setSearchResults(data.tracks.items)
    } catch (error) {
      console.error('Error searching Spotify:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectTrack = (track: SpotifyTrack) => {
    // Navigate to chord versions page
    window.location.href = `/chord-versions/${track.artists[0].name}/${track.name}?uri=${encodeURIComponent(track.uri)}`
  }

  if (status === 'loading') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!session?.accessToken) {
    return (
      <div className="text-center py-8">
        <div className="flex flex-col items-center space-y-4">
          <Music className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please sign in with Spotify to search for songs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search for a song..."
          className="flex-1 px-4 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((track) => (
            <button
              key={track.uri}
              onClick={() => handleSelectTrack(track)}
              className="w-full text-left p-4 bg-background rounded-md border border-border hover:bg-accent/5 transition-colors flex items-center gap-4 group"
            >
              {track.album?.images?.[0]?.url && (
                <div className="w-12 h-12 flex-shrink-0">
                  <img
                    src={track.album.images[0].url}
                    alt={`${track.name} album art`}
                    className="w-full h-full object-cover rounded-md"
                  />
                </div>
              )}
              <div className="flex-grow">
                <div className="font-semibold text-foreground">{track.name}</div>
                <div className="text-sm text-muted-foreground">{track.artists[0].name}</div>
              </div>
              <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all duration-200">
                <span>Chord Versions</span>
                <svg
                  className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform duration-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
