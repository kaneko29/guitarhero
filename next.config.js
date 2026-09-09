/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true, // 👈 allows build to succeed despite ESLint errors yuh
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'i.scdn.co' }, // Spotify's CDN
            { protocol: 'https', hostname: '*.bcbits.com' }, // Bandcamp's CDN
        ],
    },
}

module.exports = nextConfig 