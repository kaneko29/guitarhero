declare module '@tombatossals/react-chords/lib/Chord' {
    import { FC } from 'react';

    interface ChordProps {
        instrument: any;
        chord: any;
        lite?: boolean;
    }

    const Chord: FC<ChordProps>;
    export default Chord;
}
