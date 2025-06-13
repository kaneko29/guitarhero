'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { Music } from 'lucide-react'

interface SpotifyAuthButtonProps {
  className?: string
  signInText?: React.ReactNode
  signOutText?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
  showSignOut?: boolean
}

export function SpotifyAuthButton({
  className = '',
  signInText,
  signOutText,
  size = 'md',
  variant = 'primary',
  showSignOut = true
}: SpotifyAuthButtonProps) {
  const { data: session, status } = useSession()

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }

  const variantClasses = {
    primary: 'bg-[#1DB954] hover:bg-[#1ed760] text-white',
    secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
  }

  const signOutVariantClasses = {
    primary: 'bg-[#1DB954] hover:bg-[#1ed760] text-white',
    secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
  }

  if (status === 'loading') {
    return (
      <button
        disabled
        className={`${variantClasses[variant]} ${sizeClasses[size]} rounded-md font-medium transition-colors opacity-50 cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
      >
        <Music className="h-4 w-4" />
        Loading...
      </button>
    )
  }

  if (status === 'authenticated' && showSignOut) {
    return (
      <button
        onClick={() => signOut()}
        className={`${signOutVariantClasses[variant]} ${sizeClasses[size]} rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${className}`}
      >
        <Music className="h-4 w-4" />
        {signOutText || 'Sign out of Spotify'}
      </button>
    )
  }

  return (
    <button
      onClick={() => signIn('spotify')}
      className={`${variantClasses[variant]} ${sizeClasses[size]} rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${className}`}
    >
      <Music className="h-4 w-4" />
      {signInText || 'Sign in with Spotify'}
    </button>
  )
}
