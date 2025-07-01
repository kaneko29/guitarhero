-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_song_edits_song_id;
DROP INDEX IF EXISTS idx_song_edits_user_id;

-- Create a backup of existing data
CREATE TABLE IF NOT EXISTS song_edits_backup AS 
SELECT * FROM song_edits;

-- Remove the lyrics column
ALTER TABLE song_edits DROP COLUMN IF EXISTS lyrics;

-- Add the new chord_data column
ALTER TABLE song_edits 
ADD COLUMN IF NOT EXISTS chord_data JSONB DEFAULT '[]'::jsonb;

-- Add updated_at column if it doesn't exist
ALTER TABLE song_edits 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_song_edits_song_id ON song_edits(song_id);
CREATE INDEX IF NOT EXISTS idx_song_edits_user_id ON song_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_song_edits_created_at ON song_edits(created_at);

-- Add a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_song_edits_updated_at
    BEFORE UPDATE ON song_edits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add a comment to the table explaining the new structure
COMMENT ON TABLE song_edits IS 'Stores chord edits for songs. The chord_data column contains an array of chord placements with line_index, position, chord, and optional chord_position.'; 