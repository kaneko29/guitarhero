import { ChordGrid } from '../../components/ChordGrid'
import Link from 'next/link'

// Fake song-to-chord map
const songChordMap: Record<string, string[]> = {
  'let-it-be': ['C', 'G', 'Am', 'F'],
  'stand-by-me': ['G', 'Em', 'C', 'D', 'F', 'Am'],
  'wonderwall': ['Em', 'G', 'D', 'A7sus4', 'F#'],
  'mary': ['Em', 'G', 'Bm', 'C', 'Cmaj7', 'Gmaj7']
}

type Props = {
  params: {
    song: string
  }
}

export default function SongPage({ params }: Props) {
  const songName = params.song

  // Function to normalize song names for comparison
  const normalizeSongName = (name: string): string => {
    return name
      .toLowerCase() // Convert to lowercase
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
  }

  // Find the matching song key
  const matchingSongKey = Object.keys(songChordMap).find(
    key => normalizeSongName(key) === normalizeSongName(songName)
  )

  const chordNames = matchingSongKey ? songChordMap[matchingSongKey] : null

  if (!chordNames) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="p-6">
          <Link
            href="/"
            className="inline-block mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            ← Back
          </Link>
          <h1 className="text-4xl font-bold text-blue-600 mb-6 text-center">
            Song not found
          </h1>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="p-6">
        <Link
          href="/"
          className="inline-block mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          ← Back
        </Link>
        <h1 className="text-4xl font-bold text-blue-600 mb-6 text-center capitalize">
          {matchingSongKey.replace(/-/g, ' ')}
        </h1>
        <ChordGrid chordNames={chordNames} />
      </div>
    </main>
  )
}
