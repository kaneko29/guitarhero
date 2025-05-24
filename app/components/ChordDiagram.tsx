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
  }
  lite?: boolean
}

export const ChordDiagram: React.FC<ChordDiagramProps> = ({
  chord,
  lite = false,
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

  return <Chord chord={chord} instrument={instrument} lite={lite} />
}
