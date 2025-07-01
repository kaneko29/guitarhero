-- Enable RLS on song_edits table
ALTER TABLE song_edits ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view all song edits
CREATE POLICY "Users can view all song edits"
ON song_edits
FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow users to insert their own song edits
CREATE POLICY "Users can insert their own song edits"
ON song_edits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own song edits
CREATE POLICY "Users can update their own song edits"
ON song_edits
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to delete their own song edits
CREATE POLICY "Users can delete their own song edits"
ON song_edits
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create policy to allow users to view profiles for song edits
CREATE POLICY "Users can view profiles for song edits"
ON profiles
FOR SELECT
TO authenticated
USING (true); 