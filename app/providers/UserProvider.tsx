// app/providers/UserProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface UserProfile {
  id: string
  email?: string
  is_admin?: boolean
  // Add other profile fields as needed
}

const UserContext = createContext<UserProfile | null>(null)
const UserLoadingContext = createContext<boolean>(true)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setUser(null)
        setLoading(false)
        return
      }
      // Fetch profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      if (error || !profile) {
        setUser(null)
      } else {
        setUser({ ...authUser, ...profile })
      }
      setLoading(false)
    }
    fetchProfile()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null)
        return
      }
      // Fetch profile on auth state change
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data: profile, error }) => {
          if (error || !profile) {
            setUser(null)
          } else {
            setUser({ ...session.user, ...profile })
          }
        })
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <UserContext.Provider value={user}>
      <UserLoadingContext.Provider value={loading}>
        {children}
      </UserLoadingContext.Provider>
    </UserContext.Provider>
  )
}

export function useUser(): UserProfile | null {
  return useContext(UserContext)
}

export function useUserLoading(): boolean {
  return useContext(UserLoadingContext)
}
