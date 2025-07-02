import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    console.log('Session:', session ? 'Found' : 'Not found')

    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.split(' ')[1] || session?.accessToken

    if (!accessToken) {
      console.log('No access token available')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    console.log('Search query:', query)

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    const spotifyUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`
    console.log('Spotify API URL:', spotifyUrl)

    const response = await fetch(spotifyUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    console.log('Spotify API response status:', response.status)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Spotify API error response:', errorText)
      throw new Error(`Spotify API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Spotify API response data:', JSON.stringify(data, null, 2))

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in Spotify search:', error)
    return NextResponse.json(
      { error: 'Failed to search Spotify' },
      { status: 500 }
    )
  }
}