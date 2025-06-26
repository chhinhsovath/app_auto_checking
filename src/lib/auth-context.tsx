'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  employee_id: string
  name: string
  email: string
  department: string
  position: string
  phone?: string
  profile_image?: string
  hire_date?: string
  is_active: boolean
  created_at: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
  refreshAccessToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const isAuthenticated = !!user && !!token

  // Load auth data from localStorage on mount
  useEffect(() => {
    const loadAuthData = () => {
      try {
        const storedToken = localStorage.getItem('accessToken')
        const storedRefreshToken = localStorage.getItem('refreshToken')
        const storedUser = localStorage.getItem('user')

        if (storedToken && storedRefreshToken && storedUser) {
          setToken(storedToken)
          setRefreshToken(storedRefreshToken)
          setUser(JSON.parse(storedUser))
          
          // Verify token validity
          verifyToken(storedToken)
        }
      } catch (error) {
        console.error('Error loading auth data:', error)
        clearAuthData()
      } finally {
        setIsLoading(false)
      }
    }

    loadAuthData()
  }, [])

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.data.user)
      } else if (response.status === 401) {
        // Token expired, try to refresh
        const refreshSuccess = await refreshAccessToken()
        if (!refreshSuccess) {
          clearAuthData()
        }
      }
    } catch (error) {
      console.error('Token verification failed:', error)
      clearAuthData()
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        const { user: userData, accessToken, refreshToken: newRefreshToken } = data.data

        setUser(userData)
        setToken(accessToken)
        setRefreshToken(newRefreshToken)

        // Store in localStorage
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', newRefreshToken)
        localStorage.setItem('user', JSON.stringify(userData))

        router.push('/dashboard')
      } else {
        throw new Error(data.error || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuthData()
      router.push('/login')
    }
  }

  const clearAuthData = () => {
    setUser(null)
    setToken(null)
    setRefreshToken(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
    }
  }

  const refreshAccessToken = async (): Promise<boolean> => {
    if (!refreshToken) return false

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      const data = await response.json()

      if (response.ok) {
        const { user: userData, accessToken, refreshToken: newRefreshToken } = data.data

        setUser(userData)
        setToken(accessToken)
        setRefreshToken(newRefreshToken)

        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', newRefreshToken)
        localStorage.setItem('user', JSON.stringify(userData))

        return true
      } else {
        clearAuthData()
        return false
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      clearAuthData()
      return false
    }
  }

  // Auto refresh token before expiry
  useEffect(() => {
    if (!token) return

    const refreshInterval = setInterval(async () => {
      await refreshAccessToken()
    }, 13 * 60 * 1000) // Refresh every 13 minutes (token expires in 15)

    return () => clearInterval(refreshInterval)
  }, [token, refreshToken])

  const value: AuthContextType = {
    user,
    token,
    refreshToken,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    refreshAccessToken,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}