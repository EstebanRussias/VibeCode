defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    summary: '[Public] Connexion',
    description:
      '**Roles autorises :** public (aucune connexion requise).\n\nOuvre une session et pose le cookie httpOnly `session`, envoye ensuite automatiquement par Swagger. Comptes de demo : admin@nuits-garonne.fr / organisateur@nuits-garonne.fr / hangar@nuits-garonne.fr (admin1234), client@nuits-garonne.fr (client1234).',
    security: [],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
          },
          example: { email: 'client@nuits-garonne.fr', password: 'client1234' },
        },
      },
    },
    responses: {
      '200': { description: 'Utilisateur connecte (id, email, name, role).' },
      '400': { description: 'Email ou mot de passe manquant.' },
      '401': { description: 'Identifiants invalides.' },
    },
    $global: {
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'session',
            description: 'Cookie de session pose par POST /api/auth/login (ou register).',
          },
        },
      },
    },
  },
})

interface LoginBody {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email et mot de passe requis.' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides.' })
  }

  const session = await createSession(user.id)
  setSessionCookie(event, session.id, session.expiresAt)

  return publicUser(user)
})
