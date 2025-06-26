const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  details?: any
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) return false

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('accessToken', data.data.accessToken)
        localStorage.setItem('refreshToken', data.data.refreshToken)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        return true
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
    }

    return false
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const token = this.getToken()

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data: ApiResponse<T> = await response.json()

      if (!response.ok) {
        // Try to refresh token if 401
        if (response.status === 401 && token) {
          const refreshed = await this.refreshToken()
          if (refreshed) {
            // Retry the request with new token
            const newToken = this.getToken()
            const retryConfig = {
              ...config,
              headers: {
                ...config.headers,
                Authorization: `Bearer ${newToken}`,
              },
            }
            const retryResponse = await fetch(url, retryConfig)
            const retryData: ApiResponse<T> = await retryResponse.json()

            if (retryResponse.ok) {
              return retryData.data as T
            }
          }
        }

        throw new ApiError(
          response.status,
          data.error || `HTTP ${response.status}`,
          data
        )
      }

      return data.data as T
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(0, 'Network error', error)
    }
  }

  // Authentication endpoints
  async login(email: string, password: string) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(userData: {
    employee_id: string
    name: string
    email: string
    password: string
    department?: string
    position?: string
    phone?: string
  }) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken')
    return this.request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  }

  async getProfile() {
    return this.request('/api/auth/me')
  }

  async updateProfile(userData: any) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  // Attendance endpoints
  async checkIn(data: {
    latitude: number
    longitude: number
    device_info?: any
    notes?: string
  }) {
    return this.request('/api/attendance/checkin', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async checkOut(data: {
    latitude: number
    longitude: number
    notes?: string
  }) {
    return this.request('/api/attendance/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getAttendanceStatus() {
    return this.request('/api/attendance/status')
  }

  async getTodayAttendance() {
    return this.request('/api/attendance/today')
  }

  async getAttendanceHistory(params?: {
    page?: number
    limit?: number
    from_date?: string
    to_date?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }
    const query = searchParams.toString()
    return this.request(`/api/attendance/history${query ? `?${query}` : ''}`)
  }

  async getLocationStatus(latitude: number, longitude: number) {
    return this.request(`/api/attendance/location-status?latitude=${latitude}&longitude=${longitude}`)
  }

  async getAttendanceStats(period: 'week' | 'month' | 'year' = 'month') {
    return this.request(`/api/attendance/stats?period=${period}`)
  }

  // Staff endpoints
  async getStaff(params?: {
    page?: number
    limit?: number
    search?: string
    department?: string
    is_active?: boolean
  }) {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }
    const query = searchParams.toString()
    return this.request(`/api/staff${query ? `?${query}` : ''}`)
  }

  async getStaffById(id: number) {
    return this.request(`/api/staff/${id}`)
  }

  async createStaff(userData: any) {
    return this.request('/api/staff', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async updateStaff(id: number, userData: any) {
    return this.request(`/api/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  async deactivateStaff(id: number) {
    return this.request(`/api/staff/${id}`, {
      method: 'DELETE',
    })
  }

  async activateStaff(id: number) {
    return this.request(`/api/staff/${id}/activate`, {
      method: 'POST',
    })
  }

  async getStaffAttendance(id: number, params?: {
    page?: number
    limit?: number
    from_date?: string
    to_date?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }
    const query = searchParams.toString()
    return this.request(`/api/staff/${id}/attendance${query ? `?${query}` : ''}`)
  }

  async getDepartments() {
    return this.request('/api/staff/departments/list')
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return this.request('/api/dashboard/stats')
  }

  async getAttendanceChart(period: 'week' | 'month' | 'year' = 'week') {
    return this.request(`/api/dashboard/attendance-chart?period=${period}`)
  }

  async getLiveAttendance() {
    return this.request('/api/dashboard/live-attendance')
  }

  async getStaffLocations() {
    return this.request('/api/dashboard/staff-locations')
  }

  async getAttendanceSummary(params?: {
    from_date?: string
    to_date?: string
    department?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }
    const query = searchParams.toString()
    return this.request(`/api/dashboard/attendance-summary${query ? `?${query}` : ''}`)
  }
}

export const api = new ApiClient()
export { ApiError }
export type { ApiResponse }