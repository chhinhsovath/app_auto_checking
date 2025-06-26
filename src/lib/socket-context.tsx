'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './auth-context'
import { toast } from '@/hooks/use-toast'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  onlineUsers: any[]
  sendLocationUpdate: (location: { latitude: number; longitude: number; accuracy?: number }) => void
  sendAttendanceEvent: (event: { event: string; location?: any; details?: any }) => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const { token, user, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Disconnect if not authenticated
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // Create socket connection
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
    })

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
      setIsConnected(true)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    // Auth event handlers
    newSocket.on('connection_success', (data) => {
      console.log('Socket authentication successful:', data.message)
      toast({
        title: "Connected",
        description: data.message,
      })
    })

    // Real-time event handlers
    newSocket.on('user_status', (data) => {
      console.log('User status update:', data)
    })

    newSocket.on('staff_location_update', (data) => {
      console.log('Staff location update:', data)
    })

    newSocket.on('attendance_event', (data) => {
      console.log('Attendance event:', data)
      toast({
        title: "Attendance Update",
        description: `${data.user.name} has ${data.event.replace('_', ' ')}`,
      })
    })

    newSocket.on('attendance_notification', (data) => {
      toast({
        title: "Attendance",
        description: data.message,
        variant: data.type === 'success' ? 'default' : 'destructive',
      })
    })

    newSocket.on('notification', (data) => {
      toast({
        title: data.title || "Notification",
        description: data.message,
        variant: data.type === 'error' ? 'destructive' : 'default',
      })
    })

    newSocket.on('announcement', (data) => {
      toast({
        title: "Announcement",
        description: data.message,
      })
    })

    newSocket.on('online_users', (data) => {
      setOnlineUsers(data.users)
    })

    newSocket.on('system_alert', (data) => {
      toast({
        title: "System Alert",
        description: data.message,
        variant: data.type === 'error' ? 'destructive' : 'default',
      })
    })

    // Error handler
    newSocket.on('error', (error) => {
      console.error('Socket error:', error)
      toast({
        title: "Connection Error",
        description: error.message || "Socket connection error",
        variant: "destructive",
      })
    })

    // Ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping', (response: string) => {
          console.log('Ping response:', response)
        })
      }
    }, 30000) // Ping every 30 seconds

    setSocket(newSocket)

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval)
      newSocket.removeAllListeners()
      newSocket.disconnect()
    }
  }, [isAuthenticated, token])

  const sendLocationUpdate = (location: { latitude: number; longitude: number; accuracy?: number }) => {
    if (socket && isConnected) {
      socket.emit('location_update', {
        ...location,
        timestamp: new Date().toISOString(),
      })
    }
  }

  const sendAttendanceEvent = (event: { event: string; location?: any; details?: any }) => {
    if (socket && isConnected) {
      socket.emit('attendance_event', {
        ...event,
        timestamp: new Date().toISOString(),
      })
    }
  }

  const value: SocketContextType = {
    socket,
    isConnected,
    onlineUsers,
    sendLocationUpdate,
    sendAttendanceEvent,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}