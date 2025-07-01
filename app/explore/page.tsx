'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Music, TrendingUp, Star } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/app/providers/UserProvider';

interface FeaturedEdit {
    id: string;
    song_id: string;
    created_at: string;
    user_id: string;
    profiles: { full_name: string | null; username: string | null } | null;
    songs: { title: string; artist: string; image_url: string | null; spotify_uri: string | null; album_name: string | null } | null;
}

interface Genre {
    id: number;
    name: string;
    image_url: string;
    description: string;
}

export default function ExplorePage() {
    const [featuredEdits, setFeaturedEdits] = useState<FeaturedEdit[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const user = useUser() as any;
    const [unfeaturing, setUnfeaturing] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch featured chord edits
                const { data: editsData, error: editsError } = await supabase
                    .from('song_edits')
                    .select(`
                        id,
                        song_id,
                        created_at,
                        user_id,
                        is_featured,
                        profiles:user_id (full_name, username),
                        songs:song_id (title, artist, image_url, spotify_uri, album_name)
                    `)
                    .eq('is_featured', true)
                    .order('created_at', { ascending: false })
                    .limit(8);

                if (editsError) throw editsError;
                const mappedEdits = (editsData || []).map((edit: any) => ({
                    ...edit,
                    profiles: Array.isArray(edit.profiles) ? edit.profiles[0] : edit.profiles,
                    songs: Array.isArray(edit.songs) ? edit.songs[0] : edit.songs,
                }));
                setFeaturedEdits(mappedEdits);

                // Fetch genres (if still needed)
                const { data: genresData, error: genresError } = await supabase
                    .from('genres')
                    .select('*')
                    .order('id');

                if (genresError) throw genresError;
                setGenres(genresData || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleUnfeature = async (editId: string) => {
        setUnfeaturing(editId);
        const { error } = await supabase.from('song_edits').update({ is_featured: false }).eq('id', editId);
        if (!error) {
            setFeaturedEdits((prev) => prev.filter((e) => e.id !== editId));
        }
        setUnfeaturing(null);
    };

    return (
        <div className="container py-8">
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">Explore</h1>
                    <p className="text-muted-foreground">Discover songs with verified chord data</p>
                </div>

                {/* Trending Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <h2 className="text-2xl font-semibold text-foreground">Featured Chord Versions</h2>
                    </div>
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
                                    <div className="h-48 bg-muted" />
                                    <div className="p-4 space-y-2">
                                        <div className="h-4 bg-muted rounded w-3/4" />
                                        <div className="h-3 bg-muted rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md">
                            {error}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {featuredEdits.map((edit) => (
                                <Link href={`/playalong/${encodeURIComponent(edit.songs?.artist || '')}/${encodeURIComponent(edit.songs?.title || '')}?version=${edit.id}${edit.songs?.spotify_uri ? `&uri=${edit.songs.spotify_uri}` : ''}`} key={edit.id}>
                                    <div className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                                        <div className="relative h-48">
                                            {edit.songs?.image_url ? (
                                                <Image
                                                    src={edit.songs.image_url}
                                                    alt={edit.songs.title || ''}
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
                                            {user?.is_admin && (
                                                <button
                                                    type="button"
                                                    onClick={e => { e.preventDefault(); handleUnfeature(edit.id); }}
                                                    disabled={unfeaturing === edit.id}
                                                    className="absolute bottom-2 right-2 bg-destructive text-white px-2 py-1 rounded text-xs font-semibold shadow hover:bg-destructive/80 transition-colors"
                                                >
                                                    {unfeaturing === edit.id ? 'Removing...' : 'Remove from Explore'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{edit.songs?.title}</h3>
                                            <p className="text-muted-foreground">{edit.songs?.artist}</p>
                                            {edit.songs?.album_name && (
                                                <p className="text-sm text-muted-foreground mt-1">{edit.songs.album_name}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-2">Version by {edit.profiles?.full_name || edit.profiles?.username || 'Unknown User'}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Genres Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Music className="h-5 w-5 text-primary" />
                        <h2 className="text-2xl font-semibold text-foreground">Browse by Category</h2>
                    </div>
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md">
                            {error}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {genres.map((genre) => (
                                <Link href={`/explore/genre/${genre.id}`} key={genre.id}>
                                    <div className="relative h-48 rounded-lg overflow-hidden group">
                                        <Image
                                            src={genre.image_url}
                                            alt={genre.name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/40 flex items-center justify-center">
                                            <h3 className="text-2xl font-bold text-white">{genre.name}</h3>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
} 