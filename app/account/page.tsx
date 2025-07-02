'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, useUserLoading } from '@/app/providers/UserProvider'
import { supabase } from '@/lib/supabaseClient'
import { User, Mail, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface Profile {
    id: string
    full_name: string | null
    username: string | null
    updated_at: string | null
}

interface UserType {
    id: string;
    email: string;
    // add other properties as needed
}

export default function AccountPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isCheckingUsername, setIsCheckingUsername] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [usernameError, setUsernameError] = useState('')

    const router = useRouter()
    const user = useUser() as UserType | null
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

    const checkUsernameAvailability = async (newUsername: string) => {
        if (!newUsername) {
            setUsernameError('')
            return
        }

        setIsCheckingUsername(true)
        setUsernameError('')

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', newUsername)
                .neq('id', user?.id) // Exclude current user
                .single()

            // If no username found (error.code === 'PGRST116'), that's good - username is available
            if (error && error.code !== 'PGRST116') {
                throw error
            }

            if (data) {
                setUsernameError('This username is already taken')
            }
        } catch (err) {
            // Only log unexpected errors
            if (err instanceof Error && err.message !== 'No rows found') {
                console.error('Error checking username:', err)
            }
        } finally {
            setIsCheckingUsername(false)
        }
    }

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUsername = e.target.value
        setUsername(newUsername)

        // Debounce username check
        const timeoutId = setTimeout(() => {
            checkUsernameAvailability(newUsername)
        }, 500)

        return () => clearTimeout(timeoutId)
    }

    const handleSave = async () => {
        if (usernameError) {
            setError('Please choose a different username')
            return
        }

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

    if (loading || isLoading) {
        return (
            <div className="container py-8">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center space-y-4">
                        <User className="h-12 w-12 text-primary animate-pulse mx-auto" />
                        <p className="text-muted-foreground">Loading profile...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="container py-8">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
                    <p className="text-muted-foreground">Manage your account information and preferences</p>
                </div>

                {/* Messages */}
                {message && (
                    <div className="p-4 bg-primary/10 border border-primary/20 text-primary rounded-md flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <p>{message}</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Profile Form */}
                <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                    {/* Email Field */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={user.email || ''}
                            disabled
                            className="w-full px-4 py-2 bg-muted border border-input rounded-md text-muted-foreground"
                        />
                        <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                    </div>

                    {/* Full Name Field */}
                    <div className="space-y-2">
                        <label htmlFor="fullName" className="text-sm font-medium text-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Full Name
                        </label>
                        <input
                            type="text"
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Enter your full name"
                        />
                    </div>

                    {/* Username Field */}
                    <div className="space-y-2">
                        <label htmlFor="username" className="text-sm font-medium text-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Username
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={handleUsernameChange}
                                className={`w-full px-4 py-2 bg-background border ${usernameError ? 'border-destructive' : 'border-input'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50`}
                                placeholder="Choose a username"
                            />
                            {isCheckingUsername && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        {usernameError && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" />
                                {usernameError}
                            </p>
                        )}
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isCheckingUsername || !!usernameError}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
} 