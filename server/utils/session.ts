import type { H3Event } from 'h3'
import type { User } from '../../app/generated/prisma/client'

export const SESSION_COOKIE = 'session'

export type Role = 'USER' | 'ORGANIZER' | 'ADMIN'
export const ROLES: Role[] = ['USER', 'ORGANIZER', 'ADMIN']

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + CONFIG.auth.sessionTtlMs)
  return prisma.session.create({ data: { userId, expiresAt } })
}

export function setSessionCookie(event: H3Event, sessionId: string, expiresAt: Date) {
  setCookie(event, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

// Memorise l'utilisateur dans event.context : le middleware serveur et le
// handler appellent tous les deux cette fonction, une seule requete en base.
export async function getCurrentUser(event: H3Event): Promise<User | null> {
  if (event.context.user !== undefined) return event.context.user as User | null

  const sessionId = getCookie(event, SESSION_COOKIE)
  const session = sessionId
    ? await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } })
    : null

  const user = session && session.expiresAt > new Date() ? session.user : null
  event.context.user = user
  return user
}

export async function requireUser(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Connexion requise.' })
  }
  return user
}

export async function requireRole(event: H3Event, ...roles: Role[]) {
  const user = await requireUser(event)
  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Acces refuse pour votre role.' })
  }
  return user
}

// ORGANIZER : uniquement sur les concerts dont il est proprietaire.
// ADMIN : sur tous les concerts.
export async function requireEventManager(event: H3Event, ownerId: string) {
  const user = await requireRole(event, 'ORGANIZER', 'ADMIN')
  if (user.role === 'ADMIN' || user.id === ownerId) return user
  throw createError({
    statusCode: 403,
    statusMessage: "Reserve a l'organisateur du concert ou a un admin.",
  })
}

export function publicUser(user: { id: string; email: string; name: string; role: Role }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}
