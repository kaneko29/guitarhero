-- Add Spotify-related columns to songs table
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS spotify_uri TEXT,
ADD COLUMN IF NOT EXISTS spotify_id TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS album_name TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_songs_spotify_id ON songs(spotify_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC); 