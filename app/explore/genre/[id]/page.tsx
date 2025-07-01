'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ArrowLeft, Music, Star } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/app/providers/UserProvider';

interface Song {
    id: string;
    title: string;
    artist: string;
    image_url: string | null;
    spotify_uri: string | null;
    album_name: string | null;
    created_at: string;
}

interface Genre {
    id: number;
    name: string;
    image_url: string;
    description: string;
}

export default function GenrePage() {
    const params = useParams();
    const router = useRouter();
    const genreId = Number(params.id);
    const [genre, setGenre] = useState<Genre | null>(null);
    const [songs, setSongs] = useState<Song[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const user = useUser() as any;
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState<string | null>(null);
    const [removingSongId, setRemovingSongId] = useState<string | null>(null);
    const [removeSongError, setRemoveSongError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch genre data
                const { data: genreData, error: genreError } = await supabase
                    .from('genres')
                    .select('*')
                    .eq('id', genreId)
                    .single();

                if (genreError) throw genreError;
                setGenre(genreData);

                // Fetch songs for this genre
                const { data: songsData, error: songsError } = await supabase
                    .from('songs')
                    .select('*')
                    .eq('genre_id', genreId)
                    .order('created_at', { ascending: false });

                if (songsError) throw songsError;
                setSongs(songsData || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [genreId]);

    const handleBack = () => {
        router.back();
    };

    const handleRemoveGenre = async () => {
        setRemoving(true);
        setRemoveError(null);
        const { error } = await supabase.from('genres').delete().eq('id', genreId);
        if (error) {
            setRemoveError('Failed to remove genre');
            setRemoving(false);
        } else {
            router.push('/explore');
        }
    };

    const handleRemoveSongFromGenre = async (songId: string) => {
        setRemovingSongId(songId);
        setRemoveSongError(null);
        const { error } = await supabase.from('songs').update({ genre_id: null }).eq('id', songId);
        if (error) {
            setRemoveSongError('Failed to remove song from genre');
        } else {
            setSongs((prev) => prev.filter((s) => s.id !== songId));
        }
        setRemovingSongId(null);
    };

    if (isLoading) {
        return (
            <div className="container py-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="text-center space-y-4">
                            <Music className="h-12 w-12 text-primary animate-pulse mx-auto" />
                            <p className="text-muted-foreground">Loading genre data...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !genre) {
        return (
            <div className="container py-8">
                <div className="max-w-7xl mx-auto">
                    <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md">
                        {error || 'Genre not found'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                </div>

                {/* Genre Header */}
                <div className="relative h-64 rounded-lg overflow-hidden">
                    <Image
                        src={genre.image_url}
                        alt={genre.name}
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/40 flex items-center justify-center">
                        <div className="text-center space-y-2">
                            <h1 className="text-4xl font-bold text-white">{genre.name}</h1>
                            <p className="text-white/80 max-w-2xl mx-auto">{genre.description}</p>
                            {user?.is_admin && (
                                <button
                                    onClick={handleRemoveGenre}
                                    disabled={removing}
                                    className="mt-4 px-4 py-2 bg-destructive text-white rounded-md font-semibold hover:bg-destructive/80 transition-colors"
                                >
                                    {removing ? 'Removing...' : 'Remove Genre'}
                                </button>
                            )}
                            {removeError && <p className="text-red-500 mt-2">{removeError}</p>}
                        </div>
                    </div>
                </div>

                {/* Songs Grid */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-foreground">Songs in this Genre</h2>
                    {songs.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border rounded-lg">
                            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No songs yet</h3>
                            <p className="text-muted-foreground">Be the first to add a song to this genre!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {songs.map((song) => (
                                <div key={song.id} className="relative">
                                    <Link href={`/playalong/${song.artist}/${song.title}${song.spotify_uri ? `?uri=${song.spotify_uri}` : ''}`}>
                                        <div className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                                            <div className="relative h-48">
                                                {song.image_url ? (
                                                    <Image
                                                        src={song.image_url}
                                                        alt={song.title}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                                        <Music className="h-12 w-12 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded-full text-sm flex items-center gap-1">
                                                    <Star className="h-3 w-3" />
                                                    Verified
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{song.title}</h3>
                                                <p className="text-muted-foreground">{song.artist}</p>
                                                {song.album_name && (
                                                    <p className="text-sm text-muted-foreground mt-1">{song.album_name}</p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                    {user?.is_admin && (
                                        <button
                                            onClick={() => handleRemoveSongFromGenre(song.id)}
                                            disabled={removingSongId === song.id}
                                            className="absolute top-2 left-2 bg-destructive text-white px-2 py-1 rounded text-xs font-semibold shadow hover:bg-destructive/80 transition-colors"
                                        >
                                            {removingSongId === song.id ? 'Removing...' : 'Remove from Genre'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {removeSongError && <p className="text-red-500 mt-2">{removeSongError}</p>}
                </div>
            </div>
        </div>
    );
} 