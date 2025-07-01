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
    is_featured: boolean
}

interface Genre {
    id: number
    name: string
    description: string
}

interface Song {
    id: string
    genre_id: number | null
}

interface Profile {
    id: string
    full_name: string | null
    username: string | null
    created_at: string
}

interface SongEdit {
    id: string
    created_at: string
    user_id: string
    profiles: Profile | null
}

export default function ChordVersionsPage({ params }: { params: Promise<{ artist: string; song: string }> }) {
    const [versions, setVersions] = useState<ChordVersion[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [genres, setGenres] = useState<Genre[]>([])
    const [selectedGenre, setSelectedGenre] = useState<number | null>(null)
    const [songId, setSongId] = useState<string | null>(null)
    const [isFeatured, setIsFeatured] = useState<boolean>(false)
    const [featureLoading, setFeatureLoading] = useState(false)
    const [featuredVersionId, setFeaturedVersionId] = useState<string | null>(null)
    const [featureEditLoading, setFeatureEditLoading] = useState<string | null>(null)

    const { artist, song } = use(params)
    const decodedArtist = decodeURIComponent(artist)
    const decodedSong = decodeURIComponent(song)
    const user = useUser() as any
    const router = useRouter()

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch genres
                const { data: genresData, error: genresError } = await supabase
                    .from('genres')
                    .select('*')
                    .order('id')

                if (genresError) throw genresError
                setGenres(genresData || [])

                // Get the song ID first
                const { data: songData, error: songError } = await supabase
                    .from('songs')
                    .select('id, genre_id, is_featured')
                    .eq('artist', decodedArtist)
                    .eq('title', decodedSong)
                    .single()

                if (songError) {
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

                setSongId(songData.id)
                setSelectedGenre(songData.genre_id)
                setIsFeatured(!!songData.is_featured)

                // Get all edits for this song
                const { data: edits, error: editsError } = await supabase
                    .from('song_edits')
                    .select(`
                        id,
                        created_at,
                        user_id,
                        is_featured,
                        profiles!user_id (
                            id,
                            full_name,
                            username,
                            created_at
                        )
                    `)
                    .eq('song_id', songData.id)
                    .order('created_at', { ascending: false })

                if (editsError) throw editsError

                if (!edits) {
                    setVersions([])
                    setFeaturedVersionId(null)
                    return
                }

                // Find featured version
                const featured = edits.find((e: any) => e.is_featured);
                setFeaturedVersionId(featured ? featured.id : null);

                // Transform the data to match our interface
                const transformedVersions = edits.map((edit: any) => {
                    const isOwner = edit.user_id === user?.id
                    return {
                        id: edit.id,
                        created_at: edit.created_at,
                        user_id: edit.user_id,
                        user_name: edit.profiles?.full_name || edit.profiles?.username || 'Unknown User',
                        is_owner: isOwner,
                        is_featured: !!edit.is_featured,
                    }
                })

                setVersions(transformedVersions)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data')
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [decodedArtist, decodedSong, user?.id])

    const handleBack = () => {
        router.back()
    }

    const handleCreateNew = () => {
        // Preserve the Spotify URI if it exists in the current URL
        const currentUri = new URLSearchParams(window.location.search).get('uri')
        const baseUrl = `/edit-chords/${artist}/${song}`
        const params = new URLSearchParams()

        if (currentUri) {
            params.set('uri', currentUri)
        }

        const queryString = params.toString()
        const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl

        router.push(finalUrl)
    }

    const handleViewVersion = async (versionId: string) => {
        try {
            // Check if there's already a Spotify URI in the current URL
            const currentUri = new URLSearchParams(window.location.search).get('uri')

            let spotifyUri = currentUri

            // If no URI in current URL, try to get it from the database
            if (!spotifyUri) {
                const { data: songData, error: songError } = await supabase
                    .from('songs')
                    .select('spotify_uri')
                    .eq('artist', decodedArtist)
                    .eq('title', decodedSong)
                    .single()

                if (songError && songError.code !== 'PGRST116') {
                    throw songError
                }

                spotifyUri = songData?.spotify_uri || null
            }

            // Construct the URL with the Spotify URI if available
            const baseUrl = `/playalong/${artist}/${song}`
            const params = new URLSearchParams()

            if (spotifyUri) {
                params.set('uri', spotifyUri)
            }

            if (versionId) {
                params.set('version', versionId)
            }

            const queryString = params.toString()
            const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl

            router.push(finalUrl)
        } catch (err) {
            console.error('Error navigating to version:', err)
            // Still navigate even if we can't get the URI
            router.push(`/playalong/${artist}/${song}?version=${versionId}`)
        }
    }

    const handleEditVersion = (versionId: string) => {
        // Preserve the Spotify URI if it exists in the current URL
        const currentUri = new URLSearchParams(window.location.search).get('uri')
        const baseUrl = `/edit-chords/${artist}/${song}`
        const params = new URLSearchParams()

        if (currentUri) {
            params.set('uri', currentUri)
        }

        params.set('version', versionId)

        const queryString = params.toString()
        const finalUrl = `${baseUrl}?${queryString}`

        router.push(finalUrl)
    }

    const handleGenreChange = async (genreId: number | null) => {
        if (!songId) return

        try {
            const { error } = await supabase
                .from('songs')
                .update({ genre_id: genreId })
                .eq('id', songId)

            if (error) throw error
            setSelectedGenre(genreId)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update genre')
        }
    }

    const handleFeatureToggle = async () => {
        if (!songId) return;
        setFeatureLoading(true);
        const { error } = await supabase
            .from('songs')
            .update({ is_featured: !isFeatured })
            .eq('id', songId);
        if (!error) setIsFeatured((prev) => !prev);
        setFeatureLoading(false);
    };

    // Update handleFeatureEdit to handle both feature and unfeature
    const handleUnfeatureEdit = async (versionId: string) => {
        if (!songId) return;
        setFeatureEditLoading(versionId);
        const { error } = await supabase
            .from('song_edits')
            .update({ is_featured: false })
            .eq('id', versionId);
        if (!error) {
            setFeaturedVersionId(null);
            setVersions((prev) => prev.map(v => v.id === versionId ? { ...v, is_featured: false } : v));
        }
        setFeatureEditLoading(null);
    };

    // Add handler for featuring a version
    const handleFeatureEdit = async (versionId: string) => {
        if (!songId) return;
        setFeatureEditLoading(versionId);
        // Unfeature all, then feature this one
        const { error: unfeatureError } = await supabase
            .from('song_edits')
            .update({ is_featured: false })
            .eq('song_id', songId);
        if (unfeatureError) {
            setFeatureEditLoading(null);
            return;
        }
        const { error: featureError } = await supabase
            .from('song_edits')
            .update({ is_featured: true })
            .eq('id', versionId);
        if (!featureError) {
            setFeaturedVersionId(versionId);
            setVersions((prev) => prev.map(v => ({ ...v, is_featured: v.id === versionId })));
        }
        setFeatureEditLoading(null);
    };

    if (isLoading) {
        return (
            <div className="container py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="text-center space-y-4">
                            <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
                            <p className="text-muted-foreground">Loading song data...</p>
                        </div>
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
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="h-4 w-4" />
                        Create New Version
                    </button>
                </div>

                {/* Title and Genre */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-foreground">{decodedSong}</h1>
                        <p className="text-xl text-muted-foreground">{decodedArtist}</p>
                        {user?.is_admin && songId && (
                            <button
                                onClick={handleFeatureToggle}
                                disabled={featureLoading}
                                className={`ml-2 px-3 py-1 rounded-md text-sm font-semibold ${isFeatured ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border'} ${featureLoading ? 'opacity-50' : ''}`}
                            >
                                {isFeatured ? 'Remove from Explore' : 'Add to Explore'}
                            </button>
                        )}
                    </div>

                    {/* Genre Selection - only for admins */}
                    {user?.is_admin && (
                        <div className="bg-card border border-border rounded-lg p-6">
                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <label htmlFor="genre" className="text-sm font-medium text-foreground">
                                            {selectedGenre ? 'Change Genre' : 'Add Genre'}
                                        </label>
                                        {selectedGenre && (
                                            <button
                                                onClick={() => handleGenreChange(null)}
                                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        id="genre"
                                        value={selectedGenre || ''}
                                        onChange={(e) => handleGenreChange(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">Select a genre...</option>
                                        {genres.map((genre) => (
                                            <option key={genre.id} value={genre.id}>
                                                {genre.name}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedGenre && (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {genres.find(g => g.id === selectedGenre)?.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* End Genre Selection */}
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
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors"
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
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Create First Version
                            </button>
                        </div>
                    ) : (
                        versions.map((version) => (
                            <div key={version.id} className="group relative bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Edit className="h-4 w-4 text-primary" />
                                            <span className="font-medium text-foreground">
                                                Chord Version
                                            </span>
                                            {version.is_owner && (
                                                <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                                                    Your Version
                                                </span>
                                            )}
                                            {version.is_featured && (
                                                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full ml-2">
                                                    Featured
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {version.user_name}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(version.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-[180px] justify-end">
                                        <button
                                            onClick={() => handleViewVersion(version.id)}
                                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors"
                                        >
                                            View
                                        </button>
                                        {version.is_owner && (
                                            <button
                                                onClick={() => handleEditVersion(version.id)}
                                                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                                            >
                                                Edit
                                            </button>
                                        )}
                                        {/* Admin-only feature/unfeature button */}
                                        {user?.is_admin && (
                                            version.is_featured ? (
                                                <button
                                                    onClick={() => handleUnfeatureEdit(version.id)}
                                                    disabled={featureEditLoading === version.id}
                                                    className={`px-3 py-1 rounded-md text-xs font-semibold border bg-green-100 text-green-700 border-green-300 ${featureEditLoading === version.id ? 'opacity-50' : ''}`}
                                                >
                                                    {featureEditLoading === version.id ? 'Unfeaturing...' : 'Unfeature'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleFeatureEdit(version.id)}
                                                    disabled={featureEditLoading === version.id}
                                                    className={`px-3 py-1 rounded-md text-xs font-semibold border bg-muted text-foreground border ${featureEditLoading === version.id ? 'opacity-50' : ''}`}
                                                >
                                                    {featureEditLoading === version.id ? 'Featuring...' : 'Feature'}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
} 