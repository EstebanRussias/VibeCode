import type { Role } from '../utils/session'

// Protection centrale des routes API par role : chaque prefixe declare les
// roles autorises, et toute route /api absente de la table est refusee
// (deny by default). Les handlers revalident le role et la propriete du
// concert : ce middleware est une seconde barriere, pas la seule.
const POLICIES: Array<{ prefix: string; roles: Role[] | 'public' }> = [
  { prefix: '/api/auth/', roles: 'public' },
  { prefix: '/api/admin/', roles: ['ADMIN'] },
  { prefix: '/api/organizer/', roles: ['ORGANIZER', 'ADMIN'] },
  { prefix: '/api/scan', roles: ['ORGANIZER', 'ADMIN'] },
  { prefix: '/api/events', roles: ['USER'] },
  { prefix: '/api/reservations', roles: ['USER'] },
  { prefix: '/api/waitlist', roles: ['USER'] },
]

export default defineEventHandler(async (event) => {
  // Normalise avant comparaison (casse, doubles slashs) pour qu'une variante
  // comme /API//admin ne contourne pas la table.
  const path = event.path.split('?')[0]!.toLowerCase().replace(/\/{2,}/g, '/')
  if (path !== '/api' && !path.startsWith('/api/')) return

  const policy = POLICIES.find((p) =>
    p.prefix.endsWith('/') ? path.startsWith(p.prefix) : path === p.prefix || path.startsWith(p.prefix + '/')
  )
  if (!policy) {
    throw createError({ statusCode: 404, statusMessage: 'Route inconnue.' })
  }
  if (policy.roles === 'public') return

  await requireRole(event, ...policy.roles)
})
