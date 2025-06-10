// app/providers/UserProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const UserContext = createContext(null)
const UserLoadingContext = createContext(true)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
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

export function useUser() {
  return useContext(UserContext)
}

export function useUserLoading() {
  return useContext(UserLoadingContext)
}
