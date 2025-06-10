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
                // First try to get saved edits
                const { data: songData, error: songError } = await supabase
                    .from('songs')
                    .select('id')
                    .eq('artist', decodedArtist)
                    .eq('title', decodedSong)
                    .single()

                let savedLyrics = null
                let savedChords = null

                if (songData) {
                    const query = supabase
                        .from('song_edits')
                        .select('lyrics, chords')
                        .eq('song_id', songData.id)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    // If version ID is provided in URL, load that specific version
                    const searchParams = new URLSearchParams(window.location.search)
                    const versionId = searchParams.get('version')
                    if (versionId) {
                        query.eq('id', versionId)
                    }

                    const { data: editData, error: editError } = await query.single()

                    if (editData) {
                        savedLyrics = editData.lyrics
                        savedChords = editData.chords
                    }
                }

                // If no saved edits, get fresh lyrics
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

                    // Extract unique chords from the lyrics
                    const uniqueChords = new Set<string>()
                    processedLyrics.forEach(line => {
                        line.words?.forEach(word => {
                            if (word.chord) uniqueChords.add(word.chord)
                        })
                    })

                    // Convert to Chord array format
                    const chordArray = Array.from(uniqueChords).map((chord, index) => ({
                        id: index,
                        chord_name: chord,
                        position: index
                    }))

                    setChords(chordArray)
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

        const newChordObj = {
            id: chords.length,
            chord_name: newChord.trim(),
            position: chords.length
        }

        setChords([...chords, newChordObj])
        setNewChord('')
        setError('')
    }

    const handleDeleteChord = (chordId: number) => {
        setChords(chords.filter(chord => chord.id !== chordId))
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

    if (loading) return <div className="p-6">Loading...</div>
    if (!user) return null

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
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        {new URLSearchParams(window.location.search).get('version') && (
                            <button
                                onClick={handleDelete}
                                className="inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                                Delete Version
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h1 className="text-4xl font-bold text-blue-600 mb-2 text-center capitalize">
                        {decodedSong}
                    </h1>
                    <h2 className="text-2xl text-gray-600 mb-6 text-center capitalize">
                        by {decodedArtist}
                    </h2>

                    {saveMessage && (
                        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">
                            {saveMessage}
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Add Chord Form */}
                    <div className="mb-8">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newChord}
                                onChange={(e) => setNewChord(e.target.value)}
                                placeholder="Enter chord (e.g., C, Am, G7)"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <button
                                onClick={handleAddChord}
                                disabled={!newChord.trim()}
                                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Chord
                            </button>
                        </div>
                    </div>

                    {/* Chords List */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold mb-4">Available Chords</h3>
                        {chords.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {chords.map((chord) => (
                                    <div
                                        key={chord.id}
                                        className="bg-gray-50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => setSelectedChord(chord.chord_name)}
                                    >
                                        <span className="text-lg font-semibold">{chord.chord_name}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteChord(chord.id)
                                            }}
                                            className="text-red-500 hover:text-red-700"
                                            title="Delete chord"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center">No chords added yet</p>
                        )}
                    </div>

                    {/* Lyrics with Chord Editing */}
                    <div className="mt-8">
                        <h3 className="text-xl font-semibold mb-4">Lyrics with Chords</h3>
                        <div className="space-y-4">
                            {lyricData.map((line, lineIndex) => (
                                <div key={line.id} className="p-4 bg-gray-50 rounded-lg">
                                    <div className="flex flex-wrap gap-2">
                                        {line.words?.map((word: WordTiming, wordIndex: number) => (
                                            <div key={wordIndex} className="relative group">
                                                <select
                                                    value={word.chord || ''}
                                                    onChange={(e) => handleUpdateWordChord(lineIndex, wordIndex, e.target.value || undefined)}
                                                    className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <option value="">No chord</option>
                                                    {chords.map(chord => (
                                                        <option key={chord.id} value={chord.chord_name}>
                                                            {chord.chord_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className={`inline-block px-1 ${word.chord ? 'text-blue-600 font-semibold' : ''}`}>
                                                    {word.word}
                                                </span>
                                                {word.chord && (
                                                    <span className="absolute -top-6 left-0 text-sm text-blue-600 font-semibold">
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
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-semibold">{selectedChord}</h3>
                                    <button
                                        onClick={() => setSelectedChord(null)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        ✕
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
        </main>
    )
} 