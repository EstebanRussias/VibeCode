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
