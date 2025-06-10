'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, useUserLoading } from '@/app/providers/UserProvider'
import { supabase } from '@/lib/supabaseClient'

interface Profile {
    id: string
    full_name: string | null
    username: string | null
    updated_at: string | null
}

export default function AccountPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const router = useRouter()
    const user = useUser()
    const loading = useUserLoading()

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login')
        }
    }, [user, loading])

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user?.id)
                    .single()

                if (error) throw error

                if (data) {
                    setProfile(data)
                    setFullName(data.full_name || '')
                    setUsername(data.username || '')
                }
            } catch (err) {
                console.error('Error loading profile:', err)
                setError('Failed to load profile')
            } finally {
                setIsLoading(false)
            }
        }

        if (user) {
            loadProfile()
        }
    }, [user])

    const handleSave = async () => {
        setIsSaving(true)
        setMessage('')
        setError('')

        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user?.id,
                    full_name: fullName,
                    username: username,
                    updated_at: new Date().toISOString()
                })

            if (error) throw error

            setMessage('Profile updated successfully!')
        } catch (err) {
            console.error('Error saving profile:', err)
            setError('Failed to save profile')
        } finally {
            setIsSaving(false)
        }
    }

    if (loading || isLoading) return <div className="p-6">Loading...</div>
    if (!user) return null

    return (
        <main className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h1 className="text-3xl font-bold text-blue-600 mb-6">Account Settings</h1>

                    {message && (
                        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={user.email || ''}
                                disabled
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                            />
                            <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
                        </div>

                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="Enter your full name"
                            />
                        </div>

                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="Choose a username"
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
} 