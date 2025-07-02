"use client";

import { useUser, useUserLoading } from "@/app/providers/UserProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from '@/lib/supabaseClient';

interface UserType {
    is_admin: boolean;
    // add other properties as needed
}

export default function AdminPage() {
    const user = useUser() as UserType | null;
    const loading = useUserLoading();
    const router = useRouter();
    const [songs, setSongs] = useState<any[]>([]);
    const [songsLoading, setSongsLoading] = useState(true);
    const [songsError, setSongsError] = useState('');
    const [toggling, setToggling] = useState<string | null>(null);
    const [genres, setGenres] = useState<any[]>([]);
    const [genreName, setGenreName] = useState("");
    const [genreImage, setGenreImage] = useState("");
    const [genreDesc, setGenreDesc] = useState("");
    const [genreLoading, setGenreLoading] = useState(false);
    const [genreError, setGenreError] = useState("");
    const [genreSuccess, setGenreSuccess] = useState("");
    const [assignLoading, setAssignLoading] = useState(false);
    const [assignError, setAssignError] = useState("");
    const [songGenres, setSongGenres] = useState<{ [songId: string]: number[] }>({});

    useEffect(() => {
        if (!loading && (!user || !user.is_admin)) {
            router.replace("/");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user || !user.is_admin) return;
        async function fetchSongs() {
            setSongsLoading(true);
            setSongsError('');
            const { data, error } = await supabase.from('songs').select('*').order('created_at', { ascending: false });
            if (error) setSongsError('Failed to load songs');
            setSongs(data || []);
            setSongsLoading(false);
        }
        fetchSongs();
    }, [user]);

    useEffect(() => {
        if (!user || !user.is_admin) return;
        async function fetchGenres() {
            const { data, error } = await supabase.from("genres").select("*").order("id");
            if (!error) setGenres(data || []);
        }
        fetchGenres();
    }, [user]);

    useEffect(() => {
        if (!user || !user.is_admin) return;
        async function fetchSongGenres() {
            // Fetch all song_genres
            const { data, error } = await supabase.from("song_genres").select("song_id, genre_id");
            if (!error && data) {
                const map: { [songId: string]: number[] } = {};
                data.forEach((row: any) => {
                    if (!map[row.song_id]) map[row.song_id] = [];
                    map[row.song_id].push(row.genre_id);
                });
                setSongGenres(map);
            }
        }
        fetchSongGenres();
    }, [user, genres, songs]);

    async function handleToggleFeatured(songId: string, current: boolean) {
        setToggling(songId);
        const { error } = await supabase.from('songs').update({ is_featured: !current }).eq('id', songId);
        if (!error) {
            setSongs((prev) => prev.map((s: any) => s.id === songId ? { ...s, is_featured: !current } : s));
        }
        setToggling(null);
    }

    async function handleAddGenre(e: React.FormEvent) {
        e.preventDefault();
        setGenreLoading(true);
        setGenreError("");
        setGenreSuccess("");
        const { error, data } = await supabase.from("genres").insert({
            name: genreName,
            image_url: genreImage,
            description: genreDesc,
        });
        if (error) {
            setGenreError("Failed to add genre");
        } else {
            setGenreSuccess("Genre added!");
            setGenres((prev) => [...prev, { name: genreName, image_url: genreImage, description: genreDesc }]);
            setGenreName("");
            setGenreImage("");
            setGenreDesc("");
        }
        setGenreLoading(false);
    }

    async function handleAssignGenres(songId: string, genreIds: number[]) {
        setAssignLoading(true);
        setAssignError("");
        // Remove all for this song, then insert new
        const { error: delError } = await supabase.from("song_genres").delete().eq("song_id", songId);
        if (delError) {
            setAssignError("Failed to update genres");
            setAssignLoading(false);
            return;
        }
        const inserts = genreIds.map((gid) => ({ song_id: songId, genre_id: gid }));
        if (inserts.length > 0) {
            const { error: insError } = await supabase.from("song_genres").insert(inserts);
            if (insError) {
                setAssignError("Failed to update genres");
                setAssignLoading(false);
                return;
            }
        }
        setSongGenres((prev) => ({ ...prev, [songId]: genreIds }));
        setAssignLoading(false);
    }

    if (loading || !user) {
        return (
            <div className="container py-8">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center space-y-4">
                        <span className="text-2xl font-bold">Loading admin dashboard...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!user.is_admin) return null;

    return (
        <div className="container py-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
                <div className="space-y-6">
                    <section className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Add Genres</h2>
                        <form className="space-y-4" onSubmit={handleAddGenre}>
                            <div>
                                <label className="block text-sm font-medium mb-1">Genre Name</label>
                                <input value={genreName} onChange={e => setGenreName(e.target.value)} className="input" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Image URL</label>
                                <input value={genreImage} onChange={e => setGenreImage(e.target.value)} className="input" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea value={genreDesc} onChange={e => setGenreDesc(e.target.value)} className="input" required />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={genreLoading}>{genreLoading ? "Adding..." : "Add Genre"}</button>
                            {genreError && <p className="text-destructive">{genreError}</p>}
                            {genreSuccess && <p className="text-green-600">{genreSuccess}</p>}
                        </form>
                        <div className="mt-6">
                            <h3 className="font-semibold mb-2">Current Genres</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                {genres.map((g: any) => (
                                    <li key={g.id}><span className="font-medium">{g.name}</span> - {g.description}</li>
                                ))}
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
} 