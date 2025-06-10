'use client'
import { use } from 'react'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser, useUserLoading } from '@/app/providers/UserProvider'
import { supabase } from '@/lib/supabaseClient'

interface ChordVersion {
    id: string
    created_at: string
    user_id: string
    user_name: string
    is_owner: boolean
}

interface SongEdit {
    id: string
    created_at: string
    user_id: string
    profiles: {
        id: string
        full_name: string | null
        username: string | null
        created_at: string
    } | null
}

export default function ChordVersionsPage({ params }: { params: Promise<{ artist: string; song: string }> }) {
    const [versions, setVersions] = useState<ChordVersion[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const router = useRouter()
    const user = useUser()
    const loading = useUserLoading()
    const searchParams = useSearchParams()
    const uri = searchParams.get('uri')

    const { artist, song } = use(params)
    const decodedArtist = decodeURIComponent(artist)
    const decodedSong = decodeURIComponent(song)

    useEffect(() => {
        if (!loading && !user) {
            // Only redirect to login if trying to edit or create
            // Remove the automatic redirect
            setIsLoading(false)
        }
    }, [user, loading])

    useEffect(() => {
        const loadVersions = async () => {
            try {
                // Get the song ID first
                const { data: songData, error: songError } = await supabase
                    .from('songs')
                    .select('id')
                    .eq('artist', decodedArtist)
                    .eq('title', decodedSong)
                    .single()

                if (songError) {
                    console.error('Error fetching song:', songError)
                    if (songError.code === 'PGRST116') {
                        setVersions([])
                        setIsLoading(false)
                        return
                    }
                    throw songError
                }

                if (!songData) {
                    console.log('No song data found')
                    setVersions([])
                    setIsLoading(false)
                    return
                }

                console.log('Found song data:', songData)

                // Test query to get all users first
                const { data: allUsers, error: usersError } = await supabase
                    .from('profiles')
                    .select('*')

                console.log('All users in profiles:', allUsers)
                if (usersError) {
                    console.error('Error fetching all users:', usersError)
                }

                // Get all edits for this song with more detailed logging
                console.log('Fetching edits for song_id:', songData.id)
                const { data: edits, error: editsError } = await supabase
                    .from('song_edits')
                    .select(`
                        id,
                        created_at,
                        user_id,
                        profiles!user_id (
                            id,
                            full_name,
                            username,
                            created_at
                        )
                    `)
                    .eq('song_id', songData.id)
                    .order('created_at', { ascending: false })

                if (editsError) {
                    console.error('Error fetching edits:', editsError)
                    throw editsError
                }

                console.log('Raw edits data:', JSON.stringify(edits, null, 2))
                console.log('Current user:', user?.id)

                if (!edits) {
                    console.log('No edits found')
                    setVersions([])
                    return
                }

                // Log each edit's user relationship
                edits.forEach(edit => {
                    console.log(`Edit ${edit.id} user relationship:`, {
                        edit_user_id: edit.user_id,
                        profile_id: edit.profiles?.id,
                        profile_name: edit.profiles?.full_name,
                        has_profile: !!edit.profiles
                    })
                })

                // Process the versions to include user names and ownership
                const processedVersions = edits.map(edit => {
                    const isOwner = user ? edit.user_id === user.id : false
                    console.log(`Processing edit ${edit.id}:`, {
                        user_id: edit.user_id,
                        isOwner,
                        profile: edit.profiles,
                        currentUser: user?.id
                    })

                    // Get the best display name in order of preference:
                    // 1. Full name from profile
                    // 2. Username from profile
                    // 3. Email username (if current user)
                    // 4. "Anonymous"
                    let displayName = 'Anonymous'
                    if (isOwner) {
                        displayName = 'You'
                    } else if (edit.profiles?.full_name) {
                        displayName = edit.profiles.full_name
                    } else if (edit.profiles?.username) {
                        displayName = edit.profiles.username
                    }

                    return {
                        id: edit.id,
                        created_at: edit.created_at,
                        user_id: edit.user_id,
                        user_name: displayName,
                        is_owner: isOwner
                    }
                })

                console.log('Processed versions:', processedVersions)
                setVersions(processedVersions)
            } catch (err) {
                console.error('Error loading versions:', err)
                if (err instanceof Error) {
                    console.error('Error details:', {
                        message: err.message,
                        name: err.name,
                        stack: err.stack
                    })
                    setError(err.message)
                } else {
                    console.error('Unknown error type:', err)
                    setError('Failed to load chord versions')
                }
            } finally {
                setIsLoading(false)
            }
        }

        loadVersions()
    }, [user, decodedArtist, decodedSong])

    const handleViewVersion = (versionId: string) => {
        const uriParam = uri ? `&uri=${encodeURIComponent(uri)}` : ''
        router.push(`/playalong/${artist}/${song}?version=${versionId}${uriParam}`)
    }

    const handleEditVersion = (versionId: string) => {
        if (!user) {
            const currentPath = `/chord-versions/${artist}/${song}`
            router.push(`/login?returnTo=${encodeURIComponent(currentPath)}`)
            return
        }
        router.push(`/edit-chords/${artist}/${song}?version=${versionId}`)
    }

    const handleCreateNew = () => {
        if (!user) {
            const currentPath = `/chord-versions/${artist}/${song}`
            router.push(`/login?returnTo=${encodeURIComponent(currentPath)}`)
            return
        }
        router.push(`/edit-chords/${artist}/${song}`)
    }

    if (loading) return <div className="p-6">Loading...</div>

    return (
        <main className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={() => router.back()}
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={handleCreateNew}
                        disabled={!user}
                        className={`inline-block px-6 py-2 rounded-lg transition ${user
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        title={!user ? "Sign in to create a new version" : "Create new version"}
                    >
                        Create New Version
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h1 className="text-4xl font-bold text-blue-600 mb-2 text-center capitalize">
                        {decodedSong}
                    </h1>
                    <h2 className="text-2xl text-gray-600 mb-6 text-center capitalize">
                        by {decodedArtist}
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p>Loading versions...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Karaoke Version */}
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                <div>
                                    <h3 className="font-semibold flex items-center gap-2">
                                        Karaoke Version
                                        <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">Default</span>
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        Listen with synchronized lyrics
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleViewVersion('karaoke')}
                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                                    >
                                        View
                                    </button>
                                </div>
                            </div>

                            {versions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <p className="text-lg mb-2">No chord versions found</p>
                                    <p className="text-sm">Be the first to create one!</p>
                                </div>
                            ) : (
                                versions.map((version) => (
                                    <div
                                        key={version.id}
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div>
                                            <h3 className="font-semibold flex items-center gap-2">
                                                {version.user_name}
                                                {version.is_owner && (
                                                    <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">Your version</span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                Created {new Date(version.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleViewVersion(version.id)}
                                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                                            >
                                                View
                                            </button>
                                            {version.is_owner && (
                                                <button
                                                    onClick={() => handleEditVersion(version.id)}
                                                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
} 