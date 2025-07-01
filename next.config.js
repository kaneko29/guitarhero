/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true, // 👈 allows build to succeed despite ESLint errors
    },
    images: {
        domains: ['i.scdn.co'], // Allow images from Spotify's CDN
    },
}

module.exports = nextConfig 