'use client'

import { SessionProvider } from 'next-auth/react'
import { UserProvider } from './providers/UserProvider'
import { SongContextProvider } from './providers/SongContextProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserProvider>
        <SongContextProvider>
          {children}
        </SongContextProvider>
      </UserProvider>
    </SessionProvider>
  )
}
