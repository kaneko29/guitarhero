'use client';

import { useEffect, useState } from 'react';

type ChordData = {
    frets: number[];
    fingers: number[];
    barres: number[];
    capo: boolean;
    position?: number; // Add position number to identify different variations
};

export const useChordData = () => {
    const [chordsDb, setChordsDb] = useState<any>(null);

    useEffect(() => {
        const loadChordData = async () => {
            try {
                const chords = await import('@tombatossals/chords-db/lib/guitar.json');
                setChordsDb(chords);
            } catch (error) {
                console.error('Failed to load chord data:', error);
            }
        };

        loadChordData();
    }, []);

    const getChordData = (chordName: string): ChordData[] | undefined => {
        if (!chordsDb) return undefined;

        // Handle special cases for root notes
        let rootNote = chordName[0];
        let suffix = chordName.slice(1);

        // Handle sharp/flat cases
        if (chordName.includes('#')) {
            rootNote = chordName.split('#')[0] + 'sharp';
            suffix = chordName.split('#')[1];
        } else if (chordName.includes('b')) {
            rootNote = chordName.split('b')[0] + 'b';
            suffix = chordName.split('b')[1];
        }

        // Handle common suffix cases
        if (suffix === 'm') {
            suffix = 'minor';
        } else if (suffix === '') {
            suffix = 'major';
        }

        const chordList = chordsDb.chords[rootNote];
        if (!chordList) return undefined;

        const chordData = chordList.find((chord: any) => chord.suffix === suffix);
        if (!chordData) return undefined;

        // Return all positions with their index
        return chordData.positions.map((position: any, index: number) => ({
            frets: position.frets,
            fingers: position.fingers,
            barres: position.barres,
            capo: position.capo ?? false,
            position: index + 1
        }));
    };

    return { getChordData };
}; 