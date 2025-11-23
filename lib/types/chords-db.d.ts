declare module '@tombatossals/chords-db' {
    export const guitar: {
        chords: {
            [key: string]: {
                frets: number[];
                fingers: number[];
                barres: number[];
                capo: boolean;
                baseFret?: number; // Add baseFret
            }[];
        };
    };
} 