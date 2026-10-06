defineRouteMeta({
  openAPI: {
    tags: ['Organisateur'],
    summary: '[ORGANIZER, ADMIN] Ajouter des places a une categorie',
    description:
      '**Roles autorises :** ORGANIZER (uniquement sur ses propres concerts), ADMIN (tous les concerts).\n\nLes places ajoutees sont d\'abord proposees a la liste d\'attente.',
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'integer', minimum: 1, maximum: 10000 } } },
          example: { amount: 5 },
        },
      },
    },
    responses: {
      '200': { description: 'Categorie mise a jour.' },
      '400': { description: 'amount invalide.' },
      '401': { description: 'Non connecte.' },
      '403': { description: 'Role non autorise ou concert d\'un autre organisateur.' },
      '404': { description: 'Categorie introuvable.' },
    },
  },
})

interface AddPlacesBody {
  amount?: number
}

// Augmente le stock d'une categorie existante. Reserve a l'organisateur du
// concert ou a un ADMIN. Verrou pessimiste (2.1) pour rester coherent avec
// des reservations concurrentes ; la place ajoutee profite d'abord a la
// liste d'attente (2.4).
export default defineEventHandler(async (event) => {
  const categoryId = getRouterParam(event, 'id')
  if (!categoryId) throw createError({ statusCode: 400, statusMessage: 'Id de categorie manquant.' })

  const category = await prisma.ticketCategory.findUnique({
    where: { id: categoryId },
    include: { event: true },
  })
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Categorie introuvable.' })

  await requireEventManager(event, category.event.ownerId)

  const body = await readBody<AddPlacesBody>(event)
  const amount = Number(body?.amount)
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) {
    throw createError({ statusCode: 400, statusMessage: 'amount (entier entre 1 et 10000) requis.' })
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "TicketCategory" WHERE id = ${categoryId} FOR UPDATE
    `
    if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Categorie introuvable.' })

    await tx.ticketCategory.update({
      where: { id: categoryId },
      data: {
        totalPlaces: { increment: amount },
        placesDisponibles: { increment: amount },
      },
    })
    for (let i = 0; i < amount; i++) {
      if (!(await processWaitlistForCategory(tx, categoryId))) break
    }
    return tx.ticketCategory.findUniqueOrThrow({ where: { id: categoryId } })
  })
})
