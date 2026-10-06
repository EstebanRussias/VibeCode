interface CreateCategoryBody {
  name?: string
  totalPlaces?: number
}

// Ajout d'une categorie de billet (ex. "Fosse") a un concert existant.
// Reserve au proprietaire du concert (ADMIN) ou a un SUPERADMIN.
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: "Id d'evenement manquant." })

  const parentEvent = await prisma.event.findUnique({ where: { id: eventId } })
  if (!parentEvent) throw createError({ statusCode: 404, statusMessage: 'Evenement introuvable.' })

  await requireEventManager(event, parentEvent.ownerId)

  const body = await readBody<CreateCategoryBody>(event)
  const name = body?.name?.trim()
  const totalPlaces = Number(body?.totalPlaces)

  if (!name || !Number.isInteger(totalPlaces) || totalPlaces < 1) {
    throw createError({ statusCode: 400, statusMessage: 'name et totalPlaces (entier >= 1) sont requis.' })
  }

  const category = await prisma.ticketCategory.create({
    data: { eventId, name, totalPlaces, placesDisponibles: totalPlaces },
  })
  setResponseStatus(event, 201)
  return category
})
