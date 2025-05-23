import React from 'react';
import { Chord } from '@tombatossals/react-chords';
import { guitar, chordShapes } from '@/lib/chords';

interface SongPageProps {
  params: {
    song: string;
  };
}

export default function SongPage({ params }: SongPageProps) {
  // Hardcoded chord progression for demo — replace with dynamic chords later!
  const chords: (keyof typeof chordShapes)[] = ['C', 'G', 'Am', 'F'];

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Playalong: {params.song}</h1>

      <div className="grid grid-cols-2 gap-8">
        {chords.map((chordName) => {
          const chord = chordShapes[chordName];
          return (
            <div key={chordName} className="flex flex-col items-center">
              <span className="mb-2 text-xl font-semibold">{chordName}</span>
              {chord ? (
                <Chord instrument={guitar} chord={chord} />
              ) : (
                <span className="text-red-600">Chord diagram not found</span>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
