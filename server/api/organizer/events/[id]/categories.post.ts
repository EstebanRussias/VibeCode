import type { CategoryInput } from '../../../../utils/categories'

// Ajout d'une categorie de billet (ex. "Carre Or") a un concert existant.
// Reserve a l'organisateur du concert ou a un ADMIN.
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: "Id d'evenement manquant." })

  const parentEvent = await prisma.event.findUnique({ where: { id: eventId } })
  if (!parentEvent) throw createError({ statusCode: 404, statusMessage: 'Evenement introuvable.' })

  await requireEventManager(event, parentEvent.ownerId)

  const body = await readBody<CategoryInput>(event)
  const data = parseCategoryInput(body, parentEvent.eventDate)

  const category = await prisma.ticketCategory.create({ data: { eventId, ...data } })
  setResponseStatus(event, 201)
  return category
})
