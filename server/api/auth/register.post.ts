const EMAIL_RE = /^\S+@\S+\.\S+$/

interface RegisterBody {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterBody>(event)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password

  if (!email || !EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Email invalide.' })
  }
  if (!password || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Mot de passe : 8 caracteres minimum.' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Un compte existe deja avec cet email.' })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, passwordHash } })

  const session = await createSession(user.id)
  setSessionCookie(event, session.id, session.expiresAt)

  setResponseStatus(event, 201)
  return { id: user.id, email: user.email, role: user.role }
})
