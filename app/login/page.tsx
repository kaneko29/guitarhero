'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import { Guitar, Mail, Lock } from 'lucide-react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/'

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setError(error.message)
    router.push(returnTo)
  }

  async function handleSignup() {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return setError(error.message)
    router.push(returnTo)
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-3">
            <h1 className="guitar-hero-text text-4xl">GuitarHero</h1>
            <Guitar className="h-8 w-8 text-accent animate-pulse" />
          </div>
          <p className="text-muted-foreground text-center">
            Sign in to your account to continue
          </p>
        </div>

        <div className="space-y-6 bg-card rounded-lg border border-border p-8 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors font-medium"
                onClick={handleLogin}
              >
                Log In
              </button>

              <button
                className="w-full py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors font-medium"
                onClick={handleSignup}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
