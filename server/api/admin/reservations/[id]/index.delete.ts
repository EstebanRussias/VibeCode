defineRouteMeta({
  openAPI: {
    tags: ['Admin'],
    summary: '[ADMIN] Supprimer definitivement un billet',
    description:
      '**Roles autorises :** ADMIN.\n\nSupprime le billet de n\'importe quel compte ; les places sont remises en stock et proposees a la liste d\'attente.',
    security: [{ cookieAuth: [] }],
    responses: {
      '200': { description: '{ ok: true }' },
      '401': { description: 'Non connecte.' },
      '403': { description: 'Role non autorise.' },
      '404': { description: 'Reservation introuvable.' },
    },
  },
})

// Suppression definitive d'un billet, quel qu'en soit le proprietaire.
// Reserve a l'ADMIN (contrairement a l'annulation cote client, qui ne
// touche qu'a ses propres billets et respecte la fenetre H-48).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id de reservation manquant.' })

  await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id } })
    if (!reservation) throw createError({ statusCode: 404, statusMessage: 'Reservation introuvable.' })

    if (reservation.status === 'CONFIRMED' || reservation.status === 'HELD') {
      await tx.ticketCategory.update({
        where: { id: reservation.ticketCategoryId },
        data: { placesDisponibles: { increment: reservation.quantity } },
      })
    }

    await tx.reservation.delete({ where: { id } })

    if (reservation.status === 'CONFIRMED' || reservation.status === 'HELD') {
      await processWaitlistForCategory(tx, reservation.ticketCategoryId)
    }
  })

  return { ok: true }
})
