'use client'

import { useState, useEffect } from 'react'
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
import { ArrowLeft, Save, Trash2, Plus, Music, AlertCircle } from 'lucide-react'

interface Chord {
    id: number
    chord_name: string
    position: number
}

export default function EditChordsPage({ params }: { params: Promise<{ artist: string; song: string }> }) {
    const [chords, setChords] = useState<Chord[]>([])
    const [newChord, setNewChord] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [lyricData, setLyricData] = useState<any[]>([])
    const [selectedChord, setSelectedChord] = useState<string | null>(null)
    const { getChordData } = useChordData()
    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState('')

    const router = useRouter()
    const user = useUser()
    const loading = useUserLoading()

    const { artist, song } = use(params)
    const decodedArtist = decodeURIComponent(artist)
    const decodedSong = decodeURIComponent(song)

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login')
        }
    }, [user, loading])

    useEffect(() => {
        const loadLyrics = async () => {
            try {
                // Check if we're editing an existing version
                const searchParams = new URLSearchParams(window.location.search)
                const versionId = searchParams.get('version')

                let savedLyrics = null
                let savedChords = null

                // Only try to load saved edits if we have a version ID
                if (versionId) {
                    const { data: editData, error: editError } = await supabase
                        .from('song_edits')
                        .select('lyrics, chords')
                        .eq('id', versionId)
                        .single()

                    if (editData) {
                        savedLyrics = editData.lyrics
                        savedChords = editData.chords
                    }
                }

                // If no saved edits or creating new version, get fresh lyrics
                if (!savedLyrics) {
                    const lrcContent = await getSyncedLyrics(decodedArtist, decodedSong)
                    if (!lrcContent) {
                        throw new Error('No lyrics found for this song')
                    }

                    const parsed = parseLrcFile(lrcContent)

                    // Process each line to compute words and add chord associations
                    const processedLyrics = parsed.lyrics.map((line, lineIndex) => {
                        if (!line.text) return line

                        // Split the line into words
                        const words = line.text.split(/\s+/).filter(word => word.length > 0)

                        // Create word timings with equal distribution of time
                        const duration = (line.endTimestamp || line.timestamp + 3000) - line.timestamp
                        const wordDuration = duration / words.length

                        const wordTimings: WordTiming[] = words.map((word, wordIndex) => {
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
                    setChords([]) // Start with empty chords for new versions
                } else {
                    // Use saved data
                    setLyricData(savedLyrics)
                    setChords(savedChords)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load lyrics')
            } finally {
                setIsLoading(false)
            }
        }

        if (user) {
            loadLyrics()
        }
    }, [user, decodedArtist, decodedSong])

    const handleAddChord = () => {
        if (!newChord.trim()) return

        // Check if the chord is valid
        const chordData = getChordData(newChord.trim())
        if (!chordData) {
            setError('Invalid chord - no diagram available')
            return
        }

        // Check if chord already exists
        const normalizedChord = newChord.trim()
        if (chords.some(chord => chord.chord_name.toLowerCase() === normalizedChord.toLowerCase())) {
            setError('This chord is already in the list')
            return
        }

        const newChordObj = {
            id: chords.length,
            chord_name: normalizedChord,
            position: chords.length
        }

        setChords([...chords, newChordObj])
        setNewChord('')
        setError('')
    }

    const handleDeleteChord = (chordId: number) => {
        // Remove the chord from the list
        const updatedChords = chords.filter(chord => chord.id !== chordId)
        setChords(updatedChords)

        // Remove the chord from all words in the lyrics
        setLyricData(prevData =>
            prevData.map(line => ({
                ...line,
                words: line.words?.map(word => ({
                    ...word,
                    chord: word.chord === chords.find(c => c.id === chordId)?.chord_name ? undefined : word.chord
                }))
            }))
        )
    }

    const handleUpdateWordChord = (lineIndex: number, wordIndex: number, chord: string | undefined) => {
        // If a chord is being added, validate it
        if (chord && !getChordData(chord)) {
            setError('Invalid chord - no diagram available')
            return
        }

        setLyricData(prevData => {
            const newData = [...prevData]
            if (newData[lineIndex]?.words) {
                newData[lineIndex].words[wordIndex].chord = chord
            }
            return newData
        })
        setError('')
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

            // Redirect back to chord versions page
            router.push(`/chord-versions/${artist}/${song}`)
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

            // Create a structured data object for the song
            const songData = {
                artist: decodedArtist,
                title: decodedSong,
                updated_at: new Date().toISOString()
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
            const searchParams = new URLSearchParams(window.location.search)
            const versionId = searchParams.get('version')

            // Create or update the edit record
            const editData = {
                song_id: songId,
                user_id: user.id,
                lyrics: lyricData,
                chords: chords,
                created_at: new Date().toISOString()
            }

            if (versionId) {
                // Update existing edit
                const { error: updateError } = await supabase
                    .from('song_edits')
                    .update(editData)
                    .eq('id', versionId)
                    .eq('user_id', user.id) // Ensure user owns the edit

                if (updateError) throw updateError
                setSaveMessage('Edit updated successfully!')
            } else {
                // Create new edit
                const { error: insertError } = await supabase
                    .from('song_edits')
                    .insert([editData])

                if (insertError) throw insertError
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
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
                        {chords.map((chord) => (
                            <div
                                key={chord.id}
                                className="group relative bg-background/50 p-4 rounded-md flex items-center justify-between cursor-pointer hover:bg-background/80 transition-colors"
                                onClick={() => setSelectedChord(chord.chord_name)}
                            >
                                <span className="font-medium text-foreground">{chord.chord_name}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteChord(chord.id)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                                    title="Delete chord"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lyrics with Chords */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-medium text-foreground mb-4">Lyrics with Chords</h2>
                    <div className="space-y-6">
                        {lyricData.map((line, lineIndex) => (
                            <div key={lineIndex} className="p-4 bg-background/50 rounded-md">
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {line.words?.map((word, wordIndex) => (
                                        <div key={wordIndex} className="group relative inline-flex items-center">
                                            <select
                                                value={word.chord || ''}
                                                onChange={(e) => handleUpdateWordChord(lineIndex, wordIndex, e.target.value || undefined)}
                                                className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                            >
                                                <option value="">No chord</option>
                                                {chords.map((chord) => (
                                                    <option key={chord.id} value={chord.chord_name}>
                                                        {chord.chord_name}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className={`inline-block ${word.chord ? 'text-primary font-medium' : 'text-foreground'}`}>
                                                {word.word}
                                            </span>
                                            {word.chord && (
                                                <span className="absolute -top-6 left-0 text-sm text-primary font-medium">
                                                    {word.chord}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chord Diagram Modal */}
                {selectedChord && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 relative">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-foreground">{selectedChord}</h3>
                                <button
                                    onClick={() => setSelectedChord(null)}
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
                            </div>
                            <div className="flex justify-center">
                                <ChordDiagram
                                    chord={getChordData(selectedChord) || { frets: [], fingers: [], barres: [], capo: false }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
} 