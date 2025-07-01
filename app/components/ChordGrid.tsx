'use client';

import { ChordDiagram } from './ChordDiagram'
import { chordShapes } from '@/lib/chords'
import { useChordData } from '@/lib/dynamicChords'

type SongChordData = {
    frets: number[]
    fingers: number[]
    barres: number[]
    capo: boolean
}

type Props = {
    chordNames: string[]
    chordPositions?: { chord_name: string; chord_position: number }[]
}

export function ChordGrid({ chordNames, chordPositions }: Props) {
    const { getChordData } = useChordData()

    // Function to get the position for a chord
    const getChordPosition = (chordName: string) => {
        if (!chordPositions) return 0
        const chordData = chordPositions.find(c => c.chord_name === chordName)
        return chordData?.chord_position ?? 0
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {chordNames.map((chordName) => {
                const chordData = getChordData(chordName)
                if (!chordData) return null

                const position = getChordPosition(chordName)
                const selectedChord = chordData[position] || chordData[0]

                return (
                    <div key={chordName} className="text-center">
                        <p className="font-semibold mb-2">{chordName}</p>
                        {chordData.length > 1 && (
                            <p className="text-xs text-muted-foreground mb-1">Position {position + 1}</p>
                        )}
                        <ChordDiagram chord={selectedChord} />
                    </div>
                )
            })}
        </div>
    )
} 