# GuitarHero 🎸

A modern web application that helps guitarists learn and play along with their favorite songs. GuitarHero integrates with Spotify to provide synchronized lyrics, chord diagrams, and real-time play-along functionality.

## Features

### 🎵 **Spotify Integration**
- Search and discover songs directly from Spotify
- Authenticate with your Spotify account for seamless access
- Real-time playback control and synchronization

### 🎼 **Chord Learning**
- Interactive chord diagrams with finger positioning
- Real-time chord display synchronized with song lyrics
- Multiple chord versions and arrangements for each song
- Community-contributed chord data with verification system

### 📝 **Lyrics & Synchronization**
- Synchronized lyrics that highlight in real-time during playback
- Click-to-seek functionality for easy navigation
- Automatic lyrics fetching and parsing
- Support for LRC (Lyrics) format files

### 🎮 **Play-Along Mode**
- Real-time chord display during playback
- Visual chord diagrams that appear at the right moment
- Fullscreen mode for immersive practice sessions
- Auto-scroll lyrics for hands-free practice

### 🌟 **Community Features**
- Explore featured chord versions curated by the community
- Browse songs by genre (Rock, Pop, Jazz, Country, etc.)
- User-contributed chord arrangements
- Admin verification system for quality control

### 🎨 **Modern UI/UX**
- Beautiful, responsive design built with Next.js and Tailwind CSS
- Smooth animations and transitions
- Dark/light theme support
- Mobile-friendly interface

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Authentication**: NextAuth.js with Spotify OAuth
- **Database**: Supabase (PostgreSQL)
- **Chords**: React Chords library
- **Audio**: Spotify Web Playback SDK
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Spotify Developer Account
- Supabase Account

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd guitarhero
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Spotify API
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. **Set up Spotify App**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Add `http://localhost:3000/api/auth/callback/spotify` to Redirect URIs
   - Copy Client ID and Client Secret to your `.env.local`

5. **Set up Supabase**
   - Create a new Supabase project
   - Run the migration files in `supabase/migrations/` to set up the database schema
   - Copy your Supabase URL and keys to `.env.local`

6. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

The application uses the following main tables:
- `songs` - Song metadata and lyrics
- `song_edits` - User-contributed chord arrangements
- `genres` - Music genre categories
- `profiles` - User profiles and preferences

## Project Structure

```
guitarhero/
├── app/                    # Next.js App Router
│   ├── components/         # Reusable UI components
│   ├── api/               # API routes
│   ├── playalong/         # Play-along functionality
│   ├── chord-versions/    # Chord arrangement pages
│   ├── edit-chords/       # Chord editing interface
│   └── explore/           # Discovery and browsing
├── lib/                   # Utility functions and configurations
├── supabase/              # Database migrations and schema
└── public/                # Static assets
```

## Key Features Explained

### Chord Synchronization
The app uses a sophisticated system to display chords at the right moment during playback:
- Chord placements are stored with precise timing data
- Real-time synchronization with Spotify playback
- Visual chord diagrams appear when needed

### Lyrics Processing
- Automatic fetching from LRC (Lyrics) format sources
- Parsing and synchronization with audio timestamps
- Database caching for improved performance

### Community Contributions
- Users can create and edit chord arrangements
- Admin verification system ensures quality
- Featured versions are highlighted in the explore section

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions:
- Check the [Issues](https://github.com/your-repo/guitarhero/issues) page
- Create a new issue with detailed information
- Join our community discussions

---

**Happy playing! 🎸**
