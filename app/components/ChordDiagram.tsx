'use client'

import dynamic from 'next/dynamic'
import React from 'react'

// Dynamically import Chord to avoid SSR issues
const Chord = dynamic(() => import('@tombatossals/react-chords/lib/Chord'), {
  ssr: false,
})

type ChordDiagramProps = {
  chord: {
    frets: number[]
    fingers: number[]
    barres: number[]
    capo: boolean
    baseFret?: number // Add baseFret
  }
  lite?: boolean
  size?: number
}

export const ChordDiagram: React.FC<ChordDiagramProps> = ({
  chord,
  lite = false,
  size = 100,
}) => {
  const instrument = {
    strings: 6,
    fretsOnChord: 4,
    name: 'Guitar',
    keys: [],
    tunings: {
      standard: ['E', 'A', 'D', 'G', 'B', 'E'],
    },
  }

  // Ensure chord data is valid
  if (!chord || !Array.isArray(chord.frets)) {
    return null
  }

  return (
    <div style={{ width: size, height: size }}>
      <Chord chord={chord} instrument={instrument} lite={lite} />
    </div>
  )
}
