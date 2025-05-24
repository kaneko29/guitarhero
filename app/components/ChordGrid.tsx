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
}

export function ChordGrid({ chordNames }: Props) {
    const { getChordData } = useChordData()

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {chordNames.map((chordName) => {
                const chordData = getChordData(chordName) //|| chordShapes[chordName as keyof typeof chordShapes]
                if (!chordData) return null

                return (
                    <div key={chordName} className="text-center">
                        <p className="font-semibold mb-2">{chordName}</p>
                        <ChordDiagram chord={chordData} />
                    </div>
                )
            })}
        </div>
    )
} 