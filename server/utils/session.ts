import type { H3Event } from 'h3'

export const SESSION_COOKIE = 'session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  return prisma.session.create({ data: { userId, expiresAt } })
}

export function setSessionCookie(event: H3Event, sessionId: string, expiresAt: Date) {
  setCookie(event, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export async function getCurrentUser(event: H3Event) {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (!sessionId) return null

  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } })
  if (!session || session.expiresAt < new Date()) return null

  return session.user
}

export async function requireUser(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Connexion requise.' })
  }
  return user
}

// ADMIN et SUPERADMIN peuvent tous les deux creer des concerts (dont ils
// deviennent proprietaires). Seul SUPERADMIN peut ensuite gerer les
// concerts crees par d'autres, ou supprimer un billet.
export async function requireAnyAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Reserve aux administrateurs.' })
  }
  return user
}

export async function requireSuperAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (user.role !== 'SUPERADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Reserve au super-admin.' })
  }
  return user
}

// ADMIN : uniquement sur les concerts dont il est proprietaire.
// SUPERADMIN : sur tous les concerts, y compris ceux des autres admins.
export async function requireEventManager(event: H3Event, ownerId: string) {
  const user = await requireUser(event)
  if (user.role === 'SUPERADMIN') return user
  if (user.role === 'ADMIN' && user.id === ownerId) return user
  throw createError({
    statusCode: 403,
    statusMessage: "Reserve au proprietaire du concert ou a un super-admin.",
  })
}
