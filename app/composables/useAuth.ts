export type Role = 'USER' | 'ORGANIZER' | 'ADMIN'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
}

export const ROLE_LABELS: Record<Role, string> = {
  USER: 'Acheteur',
  ORGANIZER: 'Organisateur',
  ADMIN: 'Admin',
}

export function useAuthUser() {
  return useState<AuthUser | null | undefined>('auth-user', () => undefined)
}

export async function fetchCurrentUser() {
  const user = useAuthUser()
  // useRequestFetch transmet le cookie de session pendant le rendu serveur
  // (un $fetch nu arriverait sans cookie et verrait toujours "deconnecte").
  const requestFetch = useRequestFetch()
  user.value = await requestFetch<AuthUser | null>('/api/auth/me')
  return user.value
}

// Page d'accueil propre a chaque role.
export function homeFor(role: Role) {
  if (role === 'ADMIN') return '/admin'
  if (role === 'ORGANIZER') return '/organizer'
  return '/'
}
