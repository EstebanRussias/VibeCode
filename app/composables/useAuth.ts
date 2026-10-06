export interface AuthUser {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
}

export function useAuthUser() {
  return useState<AuthUser | null | undefined>('auth-user', () => undefined)
}

export async function fetchCurrentUser() {
  const user = useAuthUser()
  user.value = await $fetch<AuthUser | null>('/api/auth/me')
  return user.value
}
