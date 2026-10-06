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
