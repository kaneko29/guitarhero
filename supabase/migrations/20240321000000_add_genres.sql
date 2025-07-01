-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add genre_id to songs table
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS genre_id INTEGER REFERENCES genres(id);

-- Insert initial genres
INSERT INTO genres (name, image_url, description) VALUES
    ('Rock', '/images/genres/rock.jpg', 'Classic and modern rock songs with guitar-driven melodies'),
    ('Pop', '/images/genres/pop.jpg', 'Popular music with catchy melodies and contemporary sounds'),
    ('Jazz', '/images/genres/jazz.jpg', 'Smooth jazz and classic standards with rich harmonies'),
    ('Blues', '/images/genres/blues.jpg', 'Traditional and modern blues with soulful progressions'),
    ('Folk', '/images/genres/folk.jpg', 'Traditional and contemporary folk music'),
    ('Country', '/images/genres/country.jpg', 'Classic and modern country songs'),
    ('R&B', '/images/genres/rnb.jpg', 'Rhythm and blues with soulful melodies'),
    ('Hip Hop', '/images/genres/hiphop.jpg', 'Modern hip hop and rap with urban beats')
ON CONFLICT (name) DO NOTHING; 