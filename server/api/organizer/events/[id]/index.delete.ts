defineRouteMeta({
  openAPI: {
    tags: ['Organisateur'],
    summary: '[ORGANIZER, ADMIN] Supprimer un concert',
    description:
      '**Roles autorises :** ORGANIZER (uniquement ses propres concerts), ADMIN (tous les concerts).\n\nSupprime en cascade categories, reservations et listes d\'attente.',
    security: [{ cookieAuth: [] }],
    responses: {
      '200': { description: '{ ok: true }' },
      '401': { description: 'Non connecte.' },
      '403': { description: 'Role non autorise ou concert d\'un autre organisateur.' },
      '404': { description: 'Evenement introuvable.' },
    },
  },
})

// Suppression d'un concert : reserve a son organisateur ou a un ADMIN.
// Cascade en base sur les categories, reservations et listes d'attente
// liees (onDelete: Cascade dans le schema).
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: "Id d'evenement manquant." })

  const target = await prisma.event.findUnique({ where: { id: eventId } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Evenement introuvable.' })

  await requireEventManager(event, target.ownerId)

  await prisma.event.delete({ where: { id: eventId } })
  return { ok: true }
})
