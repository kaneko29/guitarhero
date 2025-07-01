'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/app/providers/UserProvider'
import { SpotifyAuthButton } from './SpotifyAuthButton'
import AuthButton from './AuthButton'
import { Guitar, Compass } from 'lucide-react'

export default function Navbar() {
    const pathname = usePathname()
    const user = useUser()

    const isActive = (path: string) => pathname === path
    const isLoginPage = pathname === '/login'

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center">
                <div className="flex flex-1 items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/"
                            className="flex items-center space-x-2 text-xl font-bold text-primary hover:text-primary/90 transition-colors"
                        >
                            <span className="guitar-hero-text">GuitarHero</span>
                            <Guitar className="h-6 w-6 text-accent" />
                        </Link>
                        <div className="hidden md:flex items-center space-x-6">
                            <Link
                                href="/"
                                className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/')
                                    ? 'text-foreground'
                                    : 'text-muted-foreground'
                                    }`}
                            >
                                Home
                            </Link>
                            <Link
                                href="/explore"
                                className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1 ${isActive('/explore')
                                    ? 'text-foreground'
                                    : 'text-muted-foreground'
                                    }`}
                            >
                                <Compass className="h-4 w-4" />
                                Explore
                            </Link>
                            {user && (
                                <Link
                                    href="/account"
                                    className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/account')
                                        ? 'text-foreground'
                                        : 'text-muted-foreground'
                                        }`}
                                >
                                    Account
                                </Link>
                            )}
                            {user && user.is_admin && (
                                <Link
                                    href="/admin"
                                    className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/admin')
                                        ? 'text-foreground'
                                        : 'text-muted-foreground'
                                        }`}
                                >
                                    Admin
                                </Link>
                            )}
                        </div>
                    </div>
                    {!isLoginPage && (
                        <div className="flex items-center gap-4">
                            <SpotifyAuthButton size="sm" />
                            <AuthButton size="sm" />
                        </div>
                    )}
                </div>
            </div>
        </nav>
    )
} 