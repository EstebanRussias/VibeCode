interface AddPlacesBody {
  amount?: number
}

// Augmente le stock d'une categorie existante. Reserve au proprietaire du
// concert (ADMIN) ou a un SUPERADMIN. Verrou pessimiste (2.1) pour rester
// coherent avec des reservations concurrentes.
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
  if (!Number.isInteger(amount) || amount < 1) {
    throw createError({ statusCode: 400, statusMessage: 'amount (entier >= 1) requis.' })
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "TicketCategory" WHERE id = ${categoryId} FOR UPDATE
    `
    if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Categorie introuvable.' })

    return tx.ticketCategory.update({
      where: { id: categoryId },
      data: {
        totalPlaces: { increment: amount },
        placesDisponibles: { increment: amount },
      },
    })
  })
})
