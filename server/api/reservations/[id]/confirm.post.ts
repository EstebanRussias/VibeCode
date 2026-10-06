// Confirmation du billet propose par la liste d'attente (section 2.4) :
// la personne notifiee clique sur son lien dans la fenetre de 2h.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id de reservation manquant.' })

  return prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({ where: { id } })
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Reservation introuvable.' })
    if (current.userId !== user.id && user.role !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: "Ce billet n'appartient pas a votre compte." })
    }

    if (current.status === 'CONFIRMED') return current // deja confirmee, idempotent

    if (current.status !== 'HELD') {
      throw createError({
        statusCode: 409,
        statusMessage: `Reservation ${current.status.toLowerCase()}, impossible a confirmer.`,
      })
    }

    if (current.holdExpiresAt && current.holdExpiresAt < new Date()) {
      await expireStaleHolds(tx, current.ticketCategoryId)
      throw createError({
        statusCode: 410,
        statusMessage: "Fenetre de confirmation expiree, la place a ete proposee au suivant.",
      })
    }

    return tx.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED', holdExpiresAt: null },
    })
  })
})
