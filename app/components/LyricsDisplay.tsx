import { useRef, useEffect } from "react"
import { ChordDiagram } from './ChordDiagram'
import { useChordData } from '@/lib/dynamicChords'
import { WordTiming } from '@/lib/types'

export default function LyricsDisplay({
  lyricData,
  currentLyricIndex,
}: {
  lyricData: any[]
  currentLyricIndex: number
}) {
  const currentLineRef = useRef<HTMLParagraphElement | null>(null)
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null)
  const { getChordData } = useChordData()

  // 🌀 Auto-scroll active lyric into view
  useEffect(() => {
    if (currentLineRef.current) {
      currentLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }, [currentLyricIndex])

  // 🚨 Guard clause: no lyrics loaded yet
  if (!lyricData || !Array.isArray(lyricData)) {
    return <div className="text-gray-400 italic">Loading lyrics...</div>
  }

  const currentLine = currentLyricIndex !== -1 ? lyricData[currentLyricIndex] : null
  const currentWords = currentLine?.words || []

  // Function to render text with highlighted words that have chords
  const renderTextWithHighlights = (line: any) => {
    if (!line.words) return line.text

    return (
      <span className="flex items-center justify-center gap-1">
        {line.words.map((word: WordTiming, index: number) => (
          <span key={index} className="relative inline-flex flex-col items-center">
            {word.chord && (
              <span className="absolute -top-5 text-sm text-blue-600 font-semibold">
                {word.chord}
              </span>
            )}
            <span className={`${word.chord ? 'text-blue-600 font-semibold' : ''}`}>
              {word.word}
            </span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Lyrics Display */}
      <div className="w-full max-w-2xl">
        <div
          ref={lyricsContainerRef}
          className="max-h-64 overflow-y-auto px-4 py-2 bg-gray bg-opacity-70 rounded-lg space-y-2"
        >
          {lyricData.map((line, index) => (
            <div key={line.id} className="h-20 flex items-center justify-center">
              <p
                ref={index === currentLyricIndex ? currentLineRef : null}
                className={`transition-all duration-300 text-lg sm:text-xl ${index === currentLyricIndex && currentLyricIndex !== -1
                  ? "text-blue font-bold"
                  : "text-gray-500"
                  }`}
              >
                {line.text?.trim() ? renderTextWithHighlights(line) : <em> * instrumental * </em>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Current Chords Display */}
      {currentWords.length > 0 && (
        <div className="flex justify-center gap-4 mt-4">
          {currentWords.map((word: WordTiming, index: number) => (
            word.chord && (
              <div key={index} className="w-32 bg-white bg-opacity-90 rounded-lg p-2 shadow-lg">
                <div className="flex flex-col items-center">
                  <p className="text-sm font-semibold mb-1">{word.word}</p>
                  <p className="text-lg font-bold text-blue-600 mb-2">{word.chord}</p>
                  <ChordDiagram
                    chord={getChordData(word.chord) || { frets: [], fingers: [], barres: [], capo: false }}
                    lite={true}
                  />
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
