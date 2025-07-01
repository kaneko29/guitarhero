-- Function to convert existing chord data to new format
CREATE OR REPLACE FUNCTION migrate_chord_data()
RETURNS void AS $$
DECLARE
    edit_record RECORD;
    line_index INTEGER;
    word_index INTEGER;
    char_position INTEGER;
    current_line TEXT;
    new_chord_data JSONB;
    lyrics_length INTEGER;
    words_length INTEGER;
BEGIN
    -- Loop through each song edit
    FOR edit_record IN 
        SELECT id, lyrics, chords 
        FROM song_edits_backup 
        WHERE lyrics IS NOT NULL
    LOOP
        new_chord_data := '[]'::jsonb;
        
        -- Get the length of lyrics array, default to 0 if null
        lyrics_length := COALESCE(jsonb_array_length(edit_record.lyrics), 0);
        
        -- Process each line in the lyrics
        FOR line_index IN 0..lyrics_length - 1 LOOP
            current_line := edit_record.lyrics->line_index->>'text';
            
            -- Skip if no text in the line
            IF current_line IS NULL THEN
                CONTINUE;
            END IF;
            
            -- Get the length of words array, default to 0 if null
            words_length := COALESCE(jsonb_array_length(edit_record.lyrics->line_index->'words'), 0);
            
            -- Process each word in the line
            FOR word_index IN 0..words_length - 1 LOOP
                -- Get the chord for this word
                DECLARE
                    word_chord TEXT;
                    word_text TEXT;
                    word_start INTEGER;
                BEGIN
                    word_chord := edit_record.lyrics->line_index->'words'->word_index->>'chord';
                    word_text := edit_record.lyrics->line_index->'words'->word_index->>'word';
                    
                    -- If there's a chord, add it to chord_data
                    IF word_chord IS NOT NULL THEN
                        -- Find the character position of the word in the line
                        word_start := position(word_text in current_line);
                        
                        -- Add the chord placement
                        new_chord_data := new_chord_data || jsonb_build_object(
                            'line_index', line_index,
                            'position', word_start,
                            'chord', word_chord,
                            'chord_position', (
                                SELECT (c->>'position')::integer
                                FROM jsonb_array_elements(edit_record.chords) AS c 
                                WHERE c->>'chord_name' = word_chord 
                                LIMIT 1
                            )
                        );
                    END IF;
                END;
            END LOOP;
        END LOOP;
        
        -- Update the song_edit with the new chord_data
        UPDATE song_edits 
        SET chord_data = new_chord_data
        WHERE id = edit_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_chord_data();

-- Drop the migration function
DROP FUNCTION migrate_chord_data();

-- Verify the migration
DO $$
BEGIN
    -- Check if all records were migrated
    IF EXISTS (
        SELECT 1 
        FROM song_edits_backup b 
        LEFT JOIN song_edits e ON b.id = e.id 
        WHERE b.lyrics IS NOT NULL 
        AND (e.chord_data IS NULL OR e.chord_data = '[]'::jsonb)
    ) THEN
        RAISE EXCEPTION 'Some records were not properly migrated';
    END IF;
END $$; 