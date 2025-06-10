'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!session?.accessToken) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Please sign in to search for songs</p>
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
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="w-full text-left p-4 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors flex items-center gap-4"
            >
              {track.album?.images?.[0]?.url && (
                <div className="w-12 h-12 flex-shrink-0">
                  <img
                    src={track.album.images[0].url}
                    alt={`${track.name} album art`}
                    className="w-full h-full object-cover rounded"
                  />
                </div>
              )}
              <div className="flex-grow">
                <div className="font-semibold">{track.name}</div>
                <div className="text-sm text-gray-600">{track.artists[0].name}</div>
              </div>
              <div className="text-blue-600 font-medium">Chord Versions</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
