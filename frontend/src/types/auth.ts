export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}
