'use client'

import { useAuth } from '@/lib/auth-context'
import { useSocket } from '@/lib/socket-context'
import { Button } from '@/components/ui/button'
import { Bell, Settings, User, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

export function DashboardHeader() {
  const { user } = useAuth()
  const { onlineUsers } = useSocket()
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Welcome message */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-4">
          {/* Online users count */}
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            <span>{onlineUsers.length} online</span>
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-gray-600 dark:text-gray-400"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-600 dark:text-gray-400 relative"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              2
            </span>
          </Button>

          {/* Profile */}
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-600 dark:text-gray-400"
          >
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}