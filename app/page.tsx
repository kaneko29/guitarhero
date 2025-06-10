'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SpotifySearch from './components/SpotifySearch';

export default function Home() {
  const [songTitle, setSongTitle] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) return;
    router.push(`/playalong/${encodeURIComponent(songTitle.trim())}/${encodeURIComponent(songTitle.trim())}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">GuitarHero 🎸</h1>
      <SpotifySearch />
    </main>
  );
}
