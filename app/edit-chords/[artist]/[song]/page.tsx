'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, useUserLoading } from '@/app/providers/UserProvider'
import { ChordGrid } from '@/app/components/ChordGrid'
import { use } from 'react'
import { getSyncedLyrics } from '@/lib/lrclib'
import { parseLrcFile } from '@/lib/lrcParser'
import { WordTiming } from '@/lib/types'
import { useChordData } from '@/lib/dynamicChords'
import { ChordDiagram } from '@/app/components/ChordDiagram'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, Save, Trash2, Plus, Music, AlertCircle, Maximize2, Minimize2 } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface Chord {
    id: number
    chord_name: string
    position: number
    chord_position?: number
}

interface ChordPlacement {
    line_index: number
    position: number
    chord: string
    chord_position?: number
}

interface Word {
    word: string
    chord?: string
}

interface LyricLine {
    text: string
    timestamp: number
    endTimestamp?: number
}

interface User {
    id: string;
    // Add other user properties as needed
}

export default function EditChordsPage({ params }: { params: Promise<{ artist: string; song: string }> }) {
    const [chords, setChords] = useState<Chord[]>([])
    const [newChord, setNewChord] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [lyricData, setLyricData] = useState<LyricLine[]>([])
    const [selectedChord, setSelectedChord] = useState<string | null>(null)
    const [selectedChordId, setSelectedChordId] = useState<number | null>(null)
    const [selectedChordPosition, setSelectedChordPosition] = useState<number>(0)
    const [chordPlacements, setChordPlacements] = useState<ChordPlacement[]>([])
    const { getChordData } = useChordData()
    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState('')
    const [selectedGenre, setSelectedGenre] = useState<number | null>(null)
    const [showChordDiagram, setShowChordDiagram] = useState(false)
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [isFullscreen, setIsFullscreen] = useState(false)
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const router = useRouter()
    const user = useUser() as User | null
    const loading = useUserLoading()
    const { data: session } = useSession()

    const { artist, song } = use(params)
    const decodedArtist = decodeURIComponent(artist)
    const decodedSong = decodeURIComponent(song)

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login')
        }
    }, [user, loading])

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Check if we're editing an existing version
                const searchParams = new URLSearchParams(window.location.search)
                const versionId = searchParams.get('version')

                let savedLyrics = null
                let savedChords = null
                let songData = null

                // Get song data to check current genre
                const { data: existingSong, error: songError } = await supabase
                    .from('songs')
                    .select('*')
                    .eq('artist', decodedArtist)
                    .eq('title', decodedSong)
                    .single()

                if (existingSong) {
                    songData = existingSong
                    setSelectedGenre(existingSong.genre_id)
                }

                // Only try to load saved edits if we have a version ID
                if (versionId) {
                    const { data: editData, error: editError } = await supabase
                        .from('song_edits')
                        .select('chord_data, chords')
                        .eq('id', versionId)
                        .single()

                    if (editData) {
                        // Load chord placements
                        const loadedChordPlacements = (editData.chord_data || []).map((placement: ChordPlacement) => placement)
                        setChordPlacements(loadedChordPlacements)

                        // If we have saved chords, use them directly (this is the primary source)
                        if (editData.chords) {
                            const savedChords = editData.chords as Chord[]
                            setChords(savedChords)
                        } else {
                            // Only extract from chord_data if no saved chords exist (fallback)
                            const chordNames = Array.from(new Set(loadedChordPlacements.map((p: ChordPlacement) => p.chord))) as string[]
                            const uniqueChords: Chord[] = chordNames.map((chordName: string, index: number) => ({
                                id: index,
                                chord_name: chordName,
                                position: index,
                                chord_position: 0
                            }))
                            setChords(uniqueChords)
                        }
                    }
                } else {
                    // For new versions, initialize with empty arrays
                    setChordPlacements([])
                    setChords([])
                }

                // If no saved edits or creating new version, get fresh lyrics
                if (!savedLyrics) {
                    // First try to get lyrics from database
                    const { data: songData, error: songError } = await supabase
                        .from('songs')
                        .select('lyrics')
                        .eq('artist', decodedArtist)
                        .eq('title', decodedSong)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single()

                    let parsedLyrics
                    if (songData?.lyrics) {
                        parsedLyrics = songData.lyrics
                    } else {
                        // Fallback to API if no lyrics in database
                        const lrcContent = await getSyncedLyrics(decodedArtist, decodedSong)
                        if (!lrcContent) {
                            throw new Error('No lyrics found for this song')
                        }
                        const parsed = parseLrcFile(lrcContent)
                        parsedLyrics = parsed.lyrics
                    }

                    // Process each line to compute words and add chord associations
                    const processedLyrics = parsedLyrics.map((line: { text?: string; timestamp: number; endTimestamp?: number }, lineIndex: number) => {
                        if (!line.text) return line

                        // Split the line into words
                        const words = line.text.split(/\s+/).filter((word: string) => word.length > 0)

                        // Create word timings with equal distribution of time
                        const duration = (line.endTimestamp || line.timestamp + 3000) - line.timestamp
                        const wordDuration = duration / words.length

                        const wordTimings: WordTiming[] = words.map((word: string, wordIndex: number) => {
                            const start = line.timestamp + (wordIndex * wordDuration)
                            const end = start + wordDuration

                            return {
                                word,
                                start,
                                end,
                                chord: undefined // Initially no chords
                            }
                        })

                        return {
                            ...line,
                            words: wordTimings
                        }
                    })

                    setLyricData(processedLyrics)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data')
            } finally {
                setIsLoading(false)
            }
        }

        if (user) {
            fetchData()
        }
    }, [user, decodedArtist, decodedSong])

    const draggingRef = useRef<{
        lineIndex: number
        chord: string
        chordPosition?: number
        originalPosition: number
        startX: number
        elementWidth: number
    } | null>(null)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current) return

            const { startX, originalPosition, chord, lineIndex, elementWidth, chordPosition } = draggingRef.current
            const deltaX = e.clientX - startX
            const deltaPercentage = (deltaX / elementWidth) * 100
            const newPosition = Math.max(0, Math.min(100, originalPosition + deltaPercentage))

            requestAnimationFrame(() => {
                setChordPlacements(prev =>
                    prev.map(p =>
                        p.line_index === lineIndex &&
                            p.chord === chord &&
                            p.position === originalPosition // Use original position for exact matching
                            ? { ...p, position: newPosition }
                            : p
                    )
                )
            })
        }

        const handleMouseUp = () => {
            draggingRef.current = null
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    const handleAddChord = () => {
        const normalizedChord = newChord.trim();
        if (!normalizedChord) {
            setError('Chord name is required');
            return;
        }

        // Check if this chord already exists
        const existingChords = chords.filter(c => c.chord_name === normalizedChord);
        const chordData = getChordData(normalizedChord);

        if (!chordData) {
            setError('Invalid chord name');
            return;
        }

        // If all positions are taken, show error
        if (existingChords.length >= chordData.length) {
            setError(`All positions for ${normalizedChord} are already taken`);
            return;
        }

        // Create a new chord with undefined position
        const newChordObj: Chord = {
            id: Date.now(),
            chord_name: normalizedChord,
            position: chords.length,
            chord_position: undefined // This ensures the popup will show position selectors
        };

        // Add the new chord to the array
        setChords(prevChords => [...prevChords, newChordObj]);
        setNewChord('');
        setError('');
        setSelectedChord(normalizedChord);
        setSelectedChordId(newChordObj.id);
        setSelectedChordPosition(0);
        setShowChordDiagram(true);
    };

    const handleDeleteChord = (chordId: number) => {
        // Get the chord name before removing it
        const chordToDelete = chords.find(c => c.id === chordId)
        if (!chordToDelete) return

        // Remove the chord from the list
        const updatedChords = chords.filter(chord => chord.id !== chordId)
        setChords(updatedChords)

        // Remove all placements of this chord
        setChordPlacements(prev =>
            prev.filter(placement => {
                // Remove placements that match the chord name and position
                const placementChordName = placement.chord.split(' (')[0] // Extract just the chord name
                return !(placementChordName === chordToDelete.chord_name &&
                    placement.chord_position === chordToDelete.chord_position)
            })
        )
    }

    const handleUpdateChordPlacement = (lineIndex: number, position: number, chord: string | undefined) => {
        // If a chord is being added, validate it
        if (chord && !getChordData(chord)) {
            setError('Invalid chord - no diagram available')
            return
        }

        setChordPlacements(prev => {
            // Remove any existing chord at this position (within a small threshold)
            const threshold = 1; // 2% threshold - reduced from 5% to allow closer placements
            const filtered = prev.filter(p =>
                !(p.line_index === lineIndex &&
                    Math.abs(p.position - position) < threshold)
            )

            // If a chord is being added, add the new placement
            if (chord && selectedChordId !== null) {
                const chordObj = chords.find(c => c.id === selectedChordId)
                if (!chordObj) return filtered

                return [...filtered, {
                    line_index: lineIndex,
                    position,
                    chord: getChordDisplayName(chordObj),
                    chord_position: chordObj.chord_position ?? 0
                }]
            }

            return filtered
        })
        setError('')
    }

    // Helper function to get display name for chord
    const getChordDisplayName = (chord: Chord) => {
        return chord.chord_name;
    }

    // Helper function to get placement name for chord
    const getChordPlacementName = (chord: string, position: number) => {
        return `${chord}_${position + 1}`
    }

    // Helper function to check if a chord position is already taken
    const isPositionTaken = (chordName: string, position: number, excludeChordId?: number) => {
        return chords.some(c =>
            c.chord_name === chordName &&
            c.chord_position === position &&
            c.id !== excludeChordId
        );
    }

    const handleDelete = async () => {
        if (!user) return

        if (!confirm('Are you sure you want to delete this version? This action cannot be undone.')) return

        try {
            const searchParams = new URLSearchParams(window.location.search)
            const versionId = searchParams.get('version')

            if (!versionId) {
                throw new Error('No version ID found')
            }

            const { error } = await supabase
                .from('song_edits')
                .delete()
                .eq('id', versionId)
                .eq('user_id', user.id) // Ensure user owns the edit

            if (error) throw error

            // Redirect back to chord versions page, preserving the URI if it exists
            const currentUri = new URLSearchParams(window.location.search).get('uri')
            const baseUrl = `/chord-versions/${artist}/${song}`
            const params = new URLSearchParams()

            if (currentUri) {
                params.set('uri', currentUri)
            }

            const queryString = params.toString()
            const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl

            router.push(finalUrl)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete version')
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        setSaveMessage('')
        try {
            if (!user) {
                throw new Error('You must be logged in to save edits')
            }

            // Get Spotify track data if URI is available
            let spotifyData = null
            const urlParams = new URLSearchParams(window.location.search)
            const spotifyUri = urlParams.get('uri')

            if (spotifyUri && session?.accessToken) {
                const trackId = spotifyUri.split(':').pop()
                const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
                    headers: {
                        'Authorization': `Bearer ${session.accessToken}`
                    }
                })
                if (response.ok) {
                    spotifyData = await response.json()
                }
            }

            // Create a structured data object for the song
            const songData = {
                artist: decodedArtist,
                title: decodedSong,
                updated_at: new Date().toISOString(),
                spotify_uri: spotifyUri || null,
                spotify_id: spotifyData?.id || null,
                image_url: spotifyData?.album?.images?.[0]?.url || null,
                album_name: spotifyData?.album?.name || null,
                genre_id: selectedGenre
            }

            // Check if the song already exists
            const { data: existingSong } = await supabase
                .from('songs')
                .select('id')
                .eq('artist', decodedArtist)
                .eq('title', decodedSong)
                .single()

            let songId: string

            if (existingSong) {
                // Update existing song
                const { error: updateError } = await supabase
                    .from('songs')
                    .update(songData)
                    .eq('id', existingSong.id)
                    .select('id')
                    .single()

                if (updateError) throw updateError
                songId = existingSong.id
            } else {
                // Insert new song
                const { data: newSong, error: insertError } = await supabase
                    .from('songs')
                    .insert([songData])
                    .select('id')
                    .single()

                if (insertError) throw insertError
                songId = newSong.id
            }

            // Get the version ID from URL if it exists
            const versionId = urlParams.get('version')

            // Create or update the edit record
            const editData = {
                song_id: songId,
                user_id: user.id,
                chord_data: chordPlacements,
                chords: chords.map(chord => ({
                    id: chord.id,
                    chord_name: chord.chord_name,
                    position: chord.position,
                    chord_position: chord.chord_position
                })),
                created_at: new Date().toISOString()
            }

            if (versionId) {
                // Update existing edit
                const { error: updateError } = await supabase
                    .from('song_edits')
                    .update(editData)
                    .eq('id', versionId)
                    .eq('user_id', user.id)

                if (updateError) throw updateError
                setSaveMessage('Edit updated successfully!')
            } else {
                // Create new edit
                const { data: newEdit, error: insertError } = await supabase
                    .from('song_edits')
                    .insert([editData])
                    .select('id')
                    .single()

                if (insertError) throw insertError

                // Update the URL with the new version ID so future autosaves update this record
                const newUrl = new URL(window.location.href)
                newUrl.searchParams.set('version', newEdit.id)
                window.history.replaceState({}, '', newUrl.toString())
                setSaveMessage('New edit created successfully!')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save song')
        } finally {
            setIsSaving(false)
        }
    }

    const handleBack = () => {
        router.back()
    }

    // Autosave function
    const triggerAutoSave = useCallback(async () => {
        if (!user) return

        setAutoSaveStatus('saving')

        try {
            // Get Spotify track data if URI is available
            let spotifyData = null
            const urlParams = new URLSearchParams(window.location.search)
            const spotifyUri = urlParams.get('uri')

            if (spotifyUri && session?.accessToken) {
                const trackId = spotifyUri.split(':').pop()
                const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
                    headers: {
                        'Authorization': `Bearer ${session.accessToken}`
                    }
                })
                if (response.ok) {
                    spotifyData = await response.json()
                }
            }

            // Create a structured data object for the song
            const songData = {
                artist: decodedArtist,
                title: decodedSong,
                updated_at: new Date().toISOString(),
                spotify_uri: spotifyUri || null,
                spotify_id: spotifyData?.id || null,
                image_url: spotifyData?.album?.images?.[0]?.url || null,
                album_name: spotifyData?.album?.name || null,
                genre_id: selectedGenre
            }

            // Check if the song already exists
            const { data: existingSong } = await supabase
                .from('songs')
                .select('id')
                .eq('artist', decodedArtist)
                .eq('title', decodedSong)
                .single()

            let songId: string

            if (existingSong) {
                // Update existing song
                const { error: updateError } = await supabase
                    .from('songs')
                    .update(songData)
                    .eq('id', existingSong.id)
                    .select('id')
                    .single()

                if (updateError) throw updateError
                songId = existingSong.id
            } else {
                // Insert new song
                const { data: newSong, error: insertError } = await supabase
                    .from('songs')
                    .insert([songData])
                    .select('id')
                    .single()

                if (insertError) throw insertError
                songId = newSong.id
            }

            // Get the version ID from URL if it exists
            const versionId = urlParams.get('version')

            // Create or update the edit record
            const editData = {
                song_id: songId,
                user_id: user.id,
                chord_data: chordPlacements,
                chords: chords.map(chord => ({
                    id: chord.id,
                    chord_name: chord.chord_name,
                    position: chord.position,
                    chord_position: chord.chord_position
                })),
                created_at: new Date().toISOString()
            }

            if (versionId) {
                // Update existing edit
                const { error: updateError } = await supabase
                    .from('song_edits')
                    .update(editData)
                    .eq('id', versionId)
                    .eq('user_id', user.id)

                if (updateError) throw updateError
            } else {
                // Create new edit
                const { data: newEdit, error: insertError } = await supabase
                    .from('song_edits')
                    .insert([editData])
                    .select('id')
                    .single()

                if (insertError) throw insertError

                // Update the URL with the new version ID so future autosaves update this record
                const newUrl = new URL(window.location.href)
                newUrl.searchParams.set('version', newEdit.id)
                window.history.replaceState({}, '', newUrl.toString())
            }

            setAutoSaveStatus('saved')

            // Clear the saved status after 3 seconds
            setTimeout(() => {
                setAutoSaveStatus('idle')
            }, 3000)

        } catch (err) {
            console.error('Autosave error:', err)
            setAutoSaveStatus('error')

            // Clear the error status after 5 seconds
            setTimeout(() => {
                setAutoSaveStatus('idle')
            }, 5000)
        }
    }, [user, decodedArtist, decodedSong, selectedGenre, chordPlacements, chords, session])

    // Debounced autosave trigger
    const debouncedAutoSave = useCallback(() => {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current)
        }

        autoSaveTimeoutRef.current = setTimeout(() => {
            triggerAutoSave()
        }, 2000) // 2 second delay
    }, [triggerAutoSave])

    const handleUpdateChordPosition = (chordId: number, position: number) => {
        const chord = chords.find(c => c.id === chordId);
        if (!chord) return;

        // Check if this position is already taken by another instance of the same chord
        const isPositionTaken = chords.some(c =>
            c.chord_name === chord.chord_name &&
            c.id !== chordId &&
            c.chord_position === position
        );

        if (isPositionTaken) {
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md shadow-lg';
            errorMessage.textContent = `Position ${position + 1} is already taken for ${chord.chord_name}`;
            document.body.appendChild(errorMessage);
            setTimeout(() => {
                document.body.removeChild(errorMessage);
            }, 2000);
            return;
        }

        setChords(chords.map(c =>
            c.id === chordId ? { ...c, chord_position: position } : c
        ));
    }

    const handleRemoveChordPlacement = (lineIndex: number, position: number, chord: string) => {
        setChordPlacements(prev => prev.filter(p => !(p.line_index === lineIndex && p.position === position && p.chord === chord)));
    };

    // Trigger autosave when chords or chord placements change
    useEffect(() => {
        if (user && !isLoading) {
            debouncedAutoSave()
        }
    }, [chords, chordPlacements, debouncedAutoSave, user, isLoading])

    // Cleanup autosave timeout on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current)
            }
        }
    }, [])

    if (isLoading) {
        return (
            <div className="container py-8">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center space-y-4">
                        <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
                        <p className="text-muted-foreground">Loading song data...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="container py-8 min-w-[1000px]">
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
                    <div className="flex items-center gap-4">
                        {/* Autosave Status */}
                        <div className="flex items-center gap-2 text-sm">
                            {autoSaveStatus === 'saving' && (
                                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Saving...</span>
                                </div>
                            )}
                            {autoSaveStatus === 'saved' && (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Saved</span>
                                </div>
                            )}
                            {autoSaveStatus === 'error' && (
                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Save failed</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="h-4 w-4" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        {new URLSearchParams(window.location.search).get('version') && (
                            <button
                                onClick={handleDelete}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Version
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {saveMessage && (
                    <div className="p-4 bg-primary/10 border border-primary/20 text-primary rounded-md">
                        {saveMessage}
                    </div>
                )}

                {/* Title */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">{decodedSong}</h1>
                    <p className="text-xl text-muted-foreground">{decodedArtist}</p>
                </div>

                {/* Add New Chord */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label htmlFor="newChord" className="block text-sm font-medium text-foreground mb-2">
                                Add New Chord
                            </label>
                            <input
                                type="text"
                                id="newChord"
                                value={newChord}
                                onChange={(e) => setNewChord(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddChord()}
                                placeholder="Enter chord name (e.g., C, Am, G7)"
                                className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <button
                            onClick={handleAddChord}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Add
                        </button>
                    </div>
                </div>

                {/* Chord Grid */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-medium text-foreground mb-4">Available Chords</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {chords.map((chord) => {
                            const isSelected = selectedChordId === chord.id;
                            return (
                                <div
                                    key={chord.id}
                                    className={`group relative bg-background/50 p-4 rounded-md flex items-center justify-between cursor-pointer hover:bg-background/80 transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedChord(null);
                                            setSelectedChordId(null);
                                            setSelectedChordPosition(0);
                                            setShowChordDiagram(false);
                                        } else {
                                            setSelectedChord(chord.chord_name);
                                            setSelectedChordId(chord.id);
                                            setSelectedChordPosition(chord.chord_position ?? 0);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium text-primary">{chord.chord_name}</span>
                                        {chord.chord_position !== undefined && (
                                            <span className="text-xs text-muted-foreground mt-1">position {chord.chord_position + 1}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isSelected && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowChordDiagram(true);
                                                }}
                                                className="text-primary hover:text-primary/80"
                                                title="View diagram"
                                            >
                                                <Music className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteChord(chord.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                                            title="Delete chord"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Lyrics with Chords */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-foreground">Lyrics with Chords</h2>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 className="h-4 w-4" />
                                    <span className="text-sm">Minimize</span>
                                </>
                            ) : (
                                <>
                                    <Maximize2 className="h-4 w-4" />
                                    <span className="text-sm">Fullscreen</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className={isFullscreen ? 'space-y-6' : 'max-h-96 overflow-y-auto space-y-6 pr-2'}>
                        {lyricData.map((line, lineIndex) => (
                            <div key={lineIndex} className="p-4 bg-background/50 rounded-md">
                                {/* Chord selectors and text container */}
                                <div className="relative min-h-[2.5rem]">
                                    {/* Chord selector overlay */}
                                    <div
                                        className="absolute inset-0 cursor-pointer"
                                        onClick={(e) => {
                                            if (!selectedChord) return; // Only allow placement if a chord is selected
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const clickX = e.clientX - rect.left;
                                            const percentage = (clickX / rect.width) * 100;
                                            handleUpdateChordPlacement(
                                                lineIndex,
                                                percentage,
                                                selectedChord
                                            );
                                        }}
                                    />

                                    {/* Display chords */}
                                    <div className="absolute -top-4 left-0 right-0 h-6">
                                        {chordPlacements
                                            .filter(p => p.line_index === lineIndex)
                                            .map((placement, index) => {
                                                const chordName = placement.chord; // No need to extract, just use the chord name directly
                                                const position = placement.chord_position !== undefined ? placement.chord_position + 1 : '';

                                                // Check if this chord placement matches the selected chord
                                                const isSelectedChord = selectedChord === chordName &&
                                                    selectedChordId !== null &&
                                                    chords.find(c => c.id === selectedChordId)?.chord_position === placement.chord_position;

                                                return (
                                                    <div
                                                        key={index}
                                                        className={`absolute transform -translate-x-1/2 group cursor-pointer select-none ${isSelectedChord ? 'z-10' : ''}`}
                                                        style={{ left: `${placement.position}%` }}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            // Find the chord object that matches this placement
                                                            const matchingChord = chords.find(c =>
                                                                c.chord_name === chordName &&
                                                                c.chord_position === placement.chord_position
                                                            )
                                                            if (matchingChord) {
                                                                setSelectedChord(chordName)
                                                                setSelectedChordId(matchingChord.id)
                                                                setSelectedChordPosition(matchingChord.chord_position ?? 0)
                                                            }
                                                        }}
                                                        onDoubleClick={() => handleRemoveChordPlacement(lineIndex, placement.position, placement.chord)}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault()

                                                            // Find the line container more reliably
                                                            const lineContainer = e.currentTarget.parentElement?.parentElement?.parentElement?.parentElement as HTMLElement
                                                            if (!lineContainer) return

                                                            const containerWidth = lineContainer.getBoundingClientRect().width

                                                            draggingRef.current = {
                                                                chord: placement.chord,
                                                                lineIndex: lineIndex,
                                                                chordPosition: placement.chord_position,
                                                                originalPosition: placement.position,
                                                                startX: e.clientX,
                                                                elementWidth: containerWidth
                                                            }
                                                        }}
                                                    >
                                                        <div className={`rounded px-2 py-1 text-xs font-medium shadow-sm relative transition-all duration-200 ${isSelectedChord
                                                            ? 'bg-blue-200 dark:bg-blue-700 border-2 border-blue-400 dark:border-blue-300 text-blue-800 dark:text-blue-200 shadow-lg'
                                                            : 'bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                                                            }`}>
                                                            <span className="font-mono">{chordName}</span>

                                                            {/* Hover tooltip */}
                                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                                                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                                                    Position {position} (click to select, double-click to remove)
                                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>

                                    {/* Lyrics text */}
                                    <div className="text-lg pt-2">
                                        {line.text?.trim() || <em> * instrumental * </em>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chord Diagram Modal */}
                {showChordDiagram && selectedChord && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 relative">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-lg font-medium text-foreground">{selectedChord}</h3>
                                    {chords.find(c => c.id === selectedChordId)?.chord_position !== undefined && (
                                        <p className="text-sm text-muted-foreground">
                                            Current position: {chords.find(c => c.id === selectedChordId)?.chord_position! + 1}
                                        </p>
                                    )}
                                </div>
                                {/* Only show exit button if chord position is already set */}
                                {chords.find(c => c.id === selectedChordId)?.chord_position !== undefined && (
                                    <button
                                        onClick={() => {
                                            setShowChordDiagram(false);
                                        }}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-5 w-5"
                                        >
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-center">
                                    <ChordDiagram
                                        chord={getChordData(selectedChord)?.[selectedChordPosition] || { frets: [], fingers: [], barres: [], capo: false }}
                                        size={400}
                                    />
                                </div>
                                {/* Show position selectors if this is a new chord or if viewing an existing chord's diagram */}
                                {chords.find(c => c.id === selectedChordId)?.chord_position === undefined && (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => {
                                                    const newPosition = Math.max(0, selectedChordPosition - 1)
                                                    setSelectedChordPosition(newPosition)
                                                }}
                                                disabled={selectedChordPosition === 0}
                                                className="p-2 rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-105"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-5 w-5 text-blue-600 dark:text-blue-400"
                                                >
                                                    <polyline points="15 18 9 12 15 6" />
                                                </svg>
                                            </button>
                                            <span className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                                                Position {selectedChordPosition + 1} of {getChordData(selectedChord)?.length || 1}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const newPosition = Math.min((getChordData(selectedChord)?.length || 1) - 1, selectedChordPosition + 1)
                                                    setSelectedChordPosition(newPosition)
                                                }}
                                                disabled={selectedChordPosition === (getChordData(selectedChord)?.length || 1) - 1}
                                                className="p-2 rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-105"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-5 w-5 text-blue-600 dark:text-blue-400"
                                                >
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (selectedChordId !== null) {
                                                    handleUpdateChordPosition(selectedChordId, selectedChordPosition)
                                                    // Show a temporary success message
                                                    const successMessage = document.createElement('div')
                                                    successMessage.className = 'fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg'
                                                    successMessage.textContent = `Set ${selectedChord} to position ${selectedChordPosition + 1}`
                                                    document.body.appendChild(successMessage)
                                                    setTimeout(() => {
                                                        document.body.removeChild(successMessage)
                                                    }, 2000)
                                                    setShowChordDiagram(false)
                                                }
                                            }}
                                            disabled={isPositionTaken(selectedChord, selectedChordPosition, selectedChordId || undefined)}
                                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            Set Position
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
} 