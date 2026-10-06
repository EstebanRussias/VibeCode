const CANCELLATION_DEADLINE_HOURS = 48

// Espace d'annulation client (module 6) : autorise jusqu'a H-48, remise en
// stock immediate et proposition automatique a la liste d'attente (2.4).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id de reservation manquant.' })

  return prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({
      where: { id },
      include: { ticketCategory: { include: { event: true } } },
    })
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Reservation introuvable.' })
    if (current.userId !== user.id && user.role !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: "Ce billet n'appartient pas a votre compte." })
    }
    if (current.status !== 'CONFIRMED') {
      throw createError({
        statusCode: 409,
        statusMessage: `Reservation ${current.status.toLowerCase()}, rien a annuler.`,
      })
    }

    const hoursUntilEvent = (current.ticketCategory.event.eventDate.getTime() - Date.now()) / 3_600_000
    if (hoursUntilEvent < CANCELLATION_DEADLINE_HOURS) {
      throw createError({
        statusCode: 422,
        statusMessage: `Annulation impossible a moins de ${CANCELLATION_DEADLINE_HOURS}h de l'evenement.`,
      })
    }

    const cancelled = await tx.reservation.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })

    await tx.ticketCategory.update({
      where: { id: current.ticketCategoryId },
      data: { placesDisponibles: { increment: current.quantity } },
    })

    await processWaitlistForCategory(tx, current.ticketCategoryId)

    return cancelled
  })
})
