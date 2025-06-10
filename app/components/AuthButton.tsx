'use client'

import { useUser } from '@/app/providers/UserProvider' // or your user hook
import { supabase } from '@/lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'

interface AuthButtonProps {
  className?: string
  signInText?: React.ReactNode
  signOutText?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
  showSignOut?: boolean
}

export default function AuthButton({
  className = '',
  signInText,
  signOutText,
  size = 'md',
  variant = 'primary',
  showSignOut = true
}: AuthButtonProps) {
  const user = useUser()
  const router = useRouter()
  const pathname = usePathname()

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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push(`/login?returnTo=${encodeURIComponent(pathname)}`)
  }

  const handleSignIn = () => {
    if (pathname === '/login') {
      router.push('/login')
    } else {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`)
    }
  }

  if (user && showSignOut) {
    return (
      <button
        onClick={handleSignOut}
        className={`${signOutVariantClasses[variant]} ${sizeClasses[size]} rounded-lg font-semibold transition-colors ${className}`}
      >
        {signOutText || 'Sign Out'}
      </button>
    )
  }

  return (
    <button
      onClick={handleSignIn}
      className={`${variantClasses[variant]} ${sizeClasses[size]} rounded-lg font-semibold transition-colors ${className}`}
    >
      {signInText || 'Sign In'}
    </button>
  )
}
