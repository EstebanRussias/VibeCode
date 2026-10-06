defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    summary: '[Public] Inscription',
    description:
      '**Roles autorises :** public (aucune connexion requise).\n\nCree toujours un compte USER et ouvre la session. Seul un ADMIN peut ensuite promouvoir le compte.',
    security: [],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'name', 'password'],
            properties: {
              email: { type: 'string', format: 'email' },
              name: { type: 'string', maxLength: 80 },
              password: { type: 'string', minLength: 8 },
            },
          },
          example: { email: 'nouveau@example.com', name: 'Nouveau client', password: 'motdepasse' },
        },
      },
    },
    responses: {
      '201': { description: 'Compte USER cree et connecte.' },
      '400': { description: 'Champ invalide.' },
      '409': { description: 'Email deja utilise.' },
      '429': { description: 'Plus de 5 inscriptions en 15 min depuis cette IP : bloquee, voir l\'en-tete Retry-After.' },
    },
  },
})

const EMAIL_RE = /^\S+@\S+\.\S+$/

interface RegisterBody {
  email?: string
  name?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  // Chaque tentative d'inscription compte (reussie ou non) : limite aussi la
  // creation de comptes en masse depuis une meme IP.
  assertNotRateLimited(event, 'register')
  recordAttempt(event, 'register')

  const body = await readBody<RegisterBody>(event)
  const email = body?.email?.trim().toLowerCase()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const password = body?.password

  if (!email || !EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Email invalide.' })
  }
  if (!name || name.length > CONFIG.auth.nameMaxLength) {
    throw createError({ statusCode: 400, statusMessage: `Nom requis (${CONFIG.auth.nameMaxLength} caracteres max).` })
  }
  if (!password || password.length < CONFIG.auth.passwordMinLength) {
    throw createError({ statusCode: 400, statusMessage: `Mot de passe : ${CONFIG.auth.passwordMinLength} caracteres minimum.` })
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
