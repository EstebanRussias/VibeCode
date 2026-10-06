import type { Role } from '~/composables/useAuth'

declare module '#app' {
  interface PageMeta {
    // Roles autorises sur la page. Absent = page publique (ex. /login).
    roles?: Role[]
  }
}

// Garde de navigation : confort d'UX uniquement. La vraie protection est
// cote serveur (server/middleware/auth.ts + chaque handler).
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useAuthUser()
  if (user.value === undefined) await fetchCurrentUser()

  const roles = to.meta.roles
  if (!roles) {
    if (to.path === '/login' && user.value) return navigateTo(homeFor(user.value.role))
    return
  }

  if (!user.value) return navigateTo('/login')
  if (!roles.includes(user.value.role)) return navigateTo(homeFor(user.value.role))
})
