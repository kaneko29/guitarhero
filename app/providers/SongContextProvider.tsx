'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface SongContextType {
  song: {
    title: string
    artist: string
  } | null
  chords: string[]
  currentChord: string | null
  setSong: (song: { title: string; artist: string } | null) => void
  setChords: (chords: string[]) => void
  setCurrentChord: (chord: string | null) => void
}

const SongContext = createContext<SongContextType | undefined>(undefined)

export function SongContextProvider({ children }: { children: ReactNode }) {
  const [song, setSong] = useState<{ title: string; artist: string } | null>(null)
  const [chords, setChords] = useState<string[]>([])
  const [currentChord, setCurrentChord] = useState<string | null>(null)

  return (
    <SongContext.Provider value={{ song, chords, currentChord, setSong, setChords, setCurrentChord }}>
      {children}
    </SongContext.Provider>
  )
}

export function useSongContext() {
  const context = useContext(SongContext)
  if (context === undefined) {
    throw new Error('useSongContext must be used within a SongContextProvider')
  }
  return context
}

