'use client';

import { useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';

export default function GuitarDetectPage() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [clarity, setClarity] = useState<number | null>(null);
  const [chord, setChord] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const pitchDetectorRef = useRef<PitchDetector<Float32Array> | null>(null);
  const recentNotesRef = useRef<{ note: string; time: number }[]>([]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((list) => {
      setDevices(list.filter((d) => d.kind === 'audioinput'));
    });
  }, []);

  const startDetection = async () => {
    if (!deviceId) {
      alert('Select an input device first.');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const sampleRate = audioContext.sampleRate;
    const detector = PitchDetector.forFloat32Array(sampleRate);
    pitchDetectorRef.current = detector;

    await audioContext.audioWorklet.addModule('/pitch-processor.js');

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'pitch-processor');

    source.connect(workletNode);

    workletNode.port.onmessage = (event) => {
      const input = new Float32Array(event.data);
      const [pitch, clarity] = detector.findPitch(input, sampleRate);

      if (pitch && clarity > 0.95) {
        const midi = hzToMidi(pitch);
        const noteName = midiToNoteName(midi);
        const simpleNote = noteName.toUpperCase().replace(/[0-9]/g, '');

        setNote(noteName);
        setFrequency(pitch);
        setClarity(clarity);

        updateRecentNotes(simpleNote);
      } else {
        setNote(null);
        setFrequency(null);
        setClarity(null);
      }
    };
  };

  const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
  const midiToNoteName = (midi: number) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rounded = Math.round(midi);
    const note = noteNames[rounded % 12];
    const octave = Math.floor(rounded / 12) - 1;
    return `${note}${octave}`;
  };

  const updateRecentNotes = (note: string) => {
    const now = Date.now();
    recentNotesRef.current.push({ note, time: now });
    recentNotesRef.current = recentNotesRef.current.filter(n => now - n.time < 500);

    const uniqueNotes = [...new Set(recentNotesRef.current.map(n => n.note))];
    const detectedChord = detectChord(uniqueNotes);
    setChord(detectedChord);
  };

  const detectChord = (notes: string[]): string | null => {
    const knownChords: Record<string, string[]> = {
      C: ['C', 'E', 'G'], Cm: ['C', 'D#', 'G'],
      D: ['D', 'F#', 'A'], Dm: ['D', 'F', 'A'],
      E: ['E', 'G#', 'B'], Em: ['E', 'G', 'B'],
      F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Gm: ['G', 'A#', 'D'],
      A: ['A', 'C#', 'E'], Am: ['A', 'C', 'E'],
      B: ['B', 'D#', 'F#'], Bm: ['B', 'D', 'F#']
    };

    for (const [chordName, chordNotes] of Object.entries(knownChords)) {
      const matchCount = chordNotes.filter(n => notes.includes(n)).length;
      if (matchCount >= 2) return chordName;
    }
    return null;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🎸 Guitar Note & Chord Detector</h1>

      <div className="mb-4">
        <label className="block mb-2">🎤 Select Input Device:</label>
        <select className="p-2 border" onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">-- Choose Input --</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Input ${device.deviceId}`}
            </option>
          ))}
        </select>
      </div>

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={startDetection}
      >
        Start Detection
      </button>

      <div className="mt-6 text-xl space-y-2">
        <p>🎵 Detected Note: <strong>{note ?? '—'}</strong></p>
        <p>📈 Frequency: {frequency ? `${frequency.toFixed(2)} Hz` : '—'}</p>
        <p>🔍 Clarity: {clarity ? `${(clarity * 100).toFixed(1)}%` : '—'}</p>
        <p>🎶 Chord: <strong>{chord ?? '—'}</strong></p>
      </div>
    </div>
  );
}
