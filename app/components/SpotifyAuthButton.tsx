'use client'

import { signIn, signOut, useSession } from 'next-auth/react'

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
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
  }

  const signOutVariantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
  }

  if (status === 'loading') {
    return (
      <button 
        disabled
        className={`${variantClasses[variant]} ${sizeClasses[size]} rounded-lg font-semibold transition-colors opacity-50 cursor-not-allowed ${className}`}
      >
        Loading...
      </button>
    )
  }

  if (status === 'authenticated' && showSignOut) {
    return (
      <button 
        onClick={() => signOut()}
        className={`${signOutVariantClasses[variant]} ${sizeClasses[size]} rounded-lg font-semibold transition-colors ${className}`}
      >
        {signOutText || 'Sign out of Spotify'}
      </button>
    )
  }

  return (
    <button 
      onClick={() => signIn('spotify')}
      className={`${variantClasses[variant]} ${sizeClasses[size]} rounded-lg font-semibold transition-colors ${className}`}
    >
      {signInText || 'Sign in with Spotify'}
    </button>
  )
}
