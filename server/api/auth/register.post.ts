const EMAIL_RE = /^\S+@\S+\.\S+$/

interface RegisterBody {
  email?: string
  name?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterBody>(event)
  const email = body?.email?.trim().toLowerCase()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const password = body?.password

  if (!email || !EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Email invalide.' })
  }
  if (!name || name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Nom requis (80 caracteres max).' })
  }
  if (!password || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Mot de passe : 8 caracteres minimum.' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Un compte existe deja avec cet email.' })
  }

  const passwordHash = await hashPassword(password)
  // Inscription publique = toujours USER : seul un ADMIN peut ensuite
  // promouvoir un compte (page gestionnaire).
  const user = await prisma.user.create({ data: { email, name, passwordHash, role: 'USER' } })

  const session = await createSession(user.id)
  setSessionCookie(event, session.id, session.expiresAt)

  setResponseStatus(event, 201)
  return publicUser(user)
})
