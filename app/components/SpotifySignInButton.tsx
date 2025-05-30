'use client'

import { signIn } from 'next-auth/react'

interface SpotifySignInButtonProps {
  className?: string
  children?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
}

export default function SpotifySignInButton({ 
  className = '', 
  children, 
  size = 'md',
  variant = 'primary'
}: SpotifySignInButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }

  const variantClasses = {
    primary: 'bg-green-500 hover:bg-green-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
  }

  return (
    <button 
      onClick={() => signIn('spotify')}
      className={`${variantClasses[variant]} ${sizeClasses[size]} rounded-lg font-semibold transition-colors ${className}`}
    >
      {children || 'Sign in with Spotify'}
    </button>
  )
}
