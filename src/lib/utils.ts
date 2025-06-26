import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

export function formatDuration(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${h}h ${m}m`
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'present':
    case 'checked_in':
    case 'active':
    case 'online':
      return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900'
    case 'absent':
    case 'not_checked_in':
    case 'offline':
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900'
    case 'checked_out':
    case 'completed':
      return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900'
    case 'late':
    case 'warning':
      return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900'
    case 'error':
    case 'failed':
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900'
    default:
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900'
  }
}

export function getAttendanceRate(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function isWithinBusinessHours(date: Date = new Date()): boolean {
  const hour = date.getHours()
  const day = date.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Check if it's a weekend (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) {
    return false
  }
  
  // Check if it's within business hours (9 AM to 6 PM)
  return hour >= 9 && hour < 18
}

export function getBusinessDaysUntil(targetDate: Date, fromDate: Date = new Date()): number {
  let count = 0
  const current = new Date(fromDate)
  
  while (current <= targetDate) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return count
}

export function generateRandomId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export function downloadFile(data: any, filename: string, type: string = 'application/json') {
  const blob = new Blob([data], { type })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export function exportToCSV(data: any[], filename: string) {
  if (!data.length) return
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      }).join(',')
    )
  ].join('\n')
  
  downloadFile(csvContent, filename, 'text/csv')
}