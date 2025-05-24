export const guitarConfig = {
  strings: 6,
  fretsOnChord: 4,
  name: 'Guitar',
  tunings: {
    standard: ['E', 'A', 'D', 'G', 'B', 'E'],
  },
};

export const chordShapes = {
  C: {
    frets: [0, 3, 2, 0, 1, 0],
    fingers: [0, 3, 2, 0, 1, 0],
    barres: [],
    capo: false,
  },
  G: {
    frets: [3, 2, 0, 0, 0, 3],
    fingers: [2, 1, 0, 0, 0, 3],
    barres: [],
    capo: false,
  },
  Am: {
    frets: [0, 0, 2, 2, 1, 0],
    fingers: [0, 0, 2, 3, 1, 0],
    barres: [],
    capo: false,
  },
  F: {
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barres: [1],
    capo: false,
  },
  Em: {
    frets: [0, 2, 2, 0, 0, 0],
    fingers: [0, 2, 3, 0, 0, 0],
    barres: [],
    capo: false,
  },
  D: {
    frets: [0, 0, 0, 2, 3, 2],
    fingers: [0, 0, 0, 1, 3, 2],
    barres: [],
    capo: false,
  },
  A7sus4: {
    frets: [0, 0, 2, 2, 3, 0],
    fingers: [0, 0, 1, 2, 4, 0],
    barres: [],
    capo: false,
  },
};
