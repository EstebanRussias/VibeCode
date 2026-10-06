defineRouteMeta({
  openAPI: {
    tags: ['Liste d\'attente'],
    summary: '[USER] S\'inscrire a la liste d\'attente',
    description:
      '**Roles autorises :** USER.\n\nUniquement sur une categorie complete. Une seule inscription active par compte et par categorie.',
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object', required: ['ticketCategoryId'], properties: { ticketCategoryId: { type: 'string' } } },
          example: { ticketCategoryId: 'demo-fosse' },
        },
      },
    },
    responses: {
      '201': { description: 'Inscription creee (ou existante).' },
      '400': { description: 'ticketCategoryId manquant.' },
      '401': { description: 'Non connecte.' },
      '403': { description: 'Role non autorise.' },
      '404': { description: 'Categorie introuvable.' },
      '409': { description: 'Des places sont encore disponibles.' },
    },
  },
})

interface WaitlistBody {
  ticketCategoryId?: string
}

// Inscription a la liste d'attente FIFO (section 2.4), liee au compte
// acheteur connecte. Le verrou sur la categorie serialise les inscriptions
// concurrentes d'un meme compte (pas de doublon dans la file).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'USER')
  const body = await readBody<WaitlistBody>(event)
  const ticketCategoryId = body?.ticketCategoryId

  if (typeof ticketCategoryId !== 'string' || !ticketCategoryId) {
    throw createError({ statusCode: 400, statusMessage: 'ticketCategoryId est requis.' })
  }

  const entry = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; placesDisponibles: number }[]>`
      SELECT id, "placesDisponibles" FROM "TicketCategory" WHERE id = ${ticketCategoryId} FOR UPDATE
    `
    const category = rows[0]
    if (!category) throw createError({ statusCode: 404, statusMessage: 'Categorie introuvable.' })
    if (category.placesDisponibles > 0) {
      throw createError({ statusCode: 409, statusMessage: 'Des places sont encore disponibles : reservez directement.' })
    }

    const existing = await tx.waitlistEntry.findFirst({
      where: { ticketCategoryId, userId: user.id, status: { in: ['WAITING', 'NOTIFIED'] } },
    })
    if (existing) return existing

    return tx.waitlistEntry.create({
      data: { ticketCategoryId, userId: user.id, email: user.email },
    })
  })

  setResponseStatus(event, 201)
  return entry
})
