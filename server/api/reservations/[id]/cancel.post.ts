const CANCELLATION_DEADLINE_HOURS = 48

// Espace d'annulation client (module 6) : autorise jusqu'a H-48, remise en
// stock immediate et proposition automatique a la liste d'attente (2.4).
// Uniquement sur ses propres billets.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'USER')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id de reservation manquant.' })

  return prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({
      where: { id },
      include: { ticketCategory: { include: { event: true } } },
    })
    // 404 aussi pour le billet d'un autre : ne confirme pas qu'il existe.
    if (!current || current.userId !== user.id) {
      throw createError({ statusCode: 404, statusMessage: 'Reservation introuvable.' })
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

    // Transition conditionnelle : deux annulations simultanees du meme billet
    // ne peuvent pas remettre deux fois les places en stock (anti-survente).
    const { count } = await tx.reservation.updateMany({
      where: { id, status: 'CONFIRMED' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    if (count === 0) {
      throw createError({ statusCode: 409, statusMessage: 'Reservation deja annulee.' })
    }

    await tx.ticketCategory.update({
      where: { id: current.ticketCategoryId },
      data: { placesDisponibles: { increment: current.quantity } },
    })

    await processWaitlistForCategory(tx, current.ticketCategoryId)

    return tx.reservation.findUniqueOrThrow({ where: { id } })
  })
})
