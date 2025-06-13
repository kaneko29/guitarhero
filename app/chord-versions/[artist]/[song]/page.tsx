'use client'
import { use } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser, useUserLoading } from '@/app/providers/UserProvider'
import { supabase } from '@/lib/supabaseClient'
import { Music, Edit, Plus, Clock, User, Mic, ArrowLeft } from 'lucide-react'

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
                    //console.error('Error fetching song:', songError)
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
        if (!user) return
        router.push(`/edit-chords/${artist}/${song}`)
    }

    const handleBack = () => {
        router.back()
    }

    if (isLoading) {
        return (
            <div className="container py-8">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center space-y-4">
                        <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
                        <p className="text-muted-foreground">Loading chord versions...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="container py-8">
                <div className="max-w-2xl mx-auto">
                    <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md">
                        {error}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="container py-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <button
                        onClick={handleCreateNew}
                        disabled={!user}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="h-4 w-4" />
                        Create New Version
                    </button>
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">{decodedSong}</h1>
                    <p className="text-xl text-muted-foreground">{decodedArtist}</p>
                </div>

                {/* Versions List */}
                <div className="space-y-4">
                    {/* Karaoke Version */}
                    <div className="group relative bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Mic className="h-4 w-4 text-primary" />
                                    <span className="font-medium text-foreground">
                                        Karaoke Version
                                    </span>
                                    <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                                        Default
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Listen with synchronized lyrics
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleViewVersion('karaoke')}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                >
                                    View
                                </button>
                            </div>
                        </div>
                    </div>

                    {versions.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border rounded-lg">
                            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No versions yet</h3>
                            <p className="text-muted-foreground mb-4">Be the first to create a chord version for this song!</p>
                            <button
                                onClick={handleCreateNew}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Create First Version
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {versions.map((version) => (
                                <div
                                    key={version.id}
                                    className="group relative bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium text-foreground">
                                                    {version.user_name}
                                                </span>
                                                {version.is_owner && (
                                                    <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                <time dateTime={version.created_at}>
                                                    {new Date(version.created_at).toLocaleDateString()}
                                                </time>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleViewVersion(version.id)}
                                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                            >
                                                View
                                            </button>
                                            {version.is_owner && (
                                                <button
                                                    onClick={() => handleEditVersion(version.id)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 