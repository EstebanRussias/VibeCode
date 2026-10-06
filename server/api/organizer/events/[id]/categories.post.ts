import type { CategoryInput } from '../../../../utils/categories'

defineRouteMeta({
  openAPI: {
    tags: ['Organisateur'],
    summary: '[ORGANIZER, ADMIN] Ajouter une categorie a un concert',
    description: '**Roles autorises :** ORGANIZER (uniquement sur ses propres concerts), ADMIN (tous les concerts).',
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CategoryInput' },
          example: { name: 'Carre Or', totalPlaces: 20, price: 55 },
        },
      },
    },
    responses: {
      '201': { description: 'Categorie creee.' },
      '400': { description: 'Donnees invalides.' },
      '401': { description: 'Non connecte.' },
      '403': { description: 'Role non autorise ou concert d\'un autre organisateur.' },
      '404': { description: 'Evenement introuvable.' },
    },
  },
})

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
