import { useRef, useEffect } from "react"

export default function LyricsDisplay({
  lyricData,
  currentLyricIndex,
}: {
  lyricData: any[]
  currentLyricIndex: number
}) {
  const currentLineRef = useRef<HTMLParagraphElement | null>(null)

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

  return (
    <div className="max-h-64 overflow-y-auto px-4 py-2 bg-gray bg-opacity-70 rounded-lg space-y-2">
      {lyricData.map((line, index) => (
        <p
          key={line.id}
          ref={index === currentLyricIndex ? currentLineRef : null}
          className={`transition-all duration-300 text-center text-lg sm:text-xl ${
            index === currentLyricIndex && currentLyricIndex !== -1
              ? "text-blue font-bold"
              : "text-gray-500"
          }`}
        >
          {line.text}
        </p>
      ))}
    </div>
  )
}
