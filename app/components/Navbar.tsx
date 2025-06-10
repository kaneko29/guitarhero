'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/app/providers/UserProvider'
import { SpotifyAuthButton } from './SpotifyAuthButton'
import AuthButton from './AuthButton'

export default function Navbar() {
    const pathname = usePathname()
    const user = useUser()

    const isActive = (path: string) => pathname === path
    const isLoginPage = pathname === '/login'

    return (
        <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/" className="text-2xl font-bold text-blue-600">
                                GuitarHero 🎸
                            </Link>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link
                                href="/"
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive('/')
                                    ? 'border-blue-500 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    }`}
                            >
                                Home
                            </Link>
                            {user && (
                                <Link
                                    href="/account"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive('/account')
                                        ? 'border-blue-500 text-gray-900'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    Account
                                </Link>
                            )}
                        </div>
                    </div>
                    {!isLoginPage && (
                        <div className="flex items-center space-x-4">
                            <SpotifyAuthButton size="sm" />
                            <AuthButton size="sm" />
                        </div>
                    )}
                </div>
            </div>
        </nav>
    )
} 