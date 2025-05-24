'use client';

import { useEffect, useState } from 'react';

export default function TestPage() {
    const [chordData, setChordData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const testChordsDb = async () => {
            try {
                // Import the JSON file directly
                const chords = await import('@tombatossals/chords-db/lib/guitar.json');
                console.log('Raw chords data:', chords);

                // Get just the chords data, then C chord, then first element
                const chordsData = chords.chords;
                const cChord = chordsData.C;
                const firstCChord = cChord.find(chord => chord.suffix === 'dim7');  // Get first element from C chord data
                console.log('First C chord data:', chords.chords.C[0]);

                setChordData(firstCChord);
            } catch (err) {
                console.error('Error loading chords:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        };

        testChordsDb();
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Chords-db Test Page</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    Error: {error}
                </div>
            )}

            {chordData && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                    <h2 className="font-bold mb-2">First C Chord Position:</h2>
                    <pre className="whitespace-pre-wrap">
                        {JSON.stringify(chordData, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
} 