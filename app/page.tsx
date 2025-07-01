'use client';

import SpotifySearch from './components/SpotifySearch';
import { Guitar } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-background p-6">
      <div className="container flex max-w-3xl flex-col items-center space-y-8 text-center">
        <div className="flex items-center space-x-3">
          <h1 className="guitar-hero-text text-4xl">GuitarHero</h1>
          <Guitar className="h-8 w-8 text-accent animate-pulse" />
        </div>
        <p className="text-lg text-muted-foreground">
          Learn the chords to your favorite songs 
        </p>
        <div className="w-full max-w-xl">
          <SpotifySearch />
        </div>
      </div>
    </main>
  );
}
