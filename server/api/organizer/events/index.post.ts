import type { CategoryInput } from '../../../utils/categories'

defineRouteMeta({
  openAPI: {
    tags: ['Organisateur'],
    summary: '[ORGANIZER, ADMIN] Creer un concert avec ses categories',
    description:
      '**Roles autorises :** ORGANIZER, ADMIN (le compte connecte devient proprietaire du concert).\n\nDates en UTC. Prix en euros. Entre 1 et 20 categories ; le tarif early demande earlyPrice ET earlyUntil.',
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'eventDate', 'categories'],
            properties: {
              name: { type: 'string', maxLength: 120 },
              eventDate: { type: 'string', format: 'date-time' },
              categories: { type: 'array', minItems: 1, maxItems: 20, items: { $ref: '#/components/schemas/CategoryInput' } },
            },
          },
          example: {
            name: 'Concert de test',
            eventDate: '2027-06-21T20:00:00Z',
            categories: [
              { name: 'Fosse', totalPlaces: 100, price: 25, earlyPrice: 18, earlyUntil: '2027-05-01T00:00:00Z' },
              { name: 'Balcon', totalPlaces: 40, price: 35 },
            ],
          },
        },
      },
    },
    responses: {
      '201': { description: 'Concert cree avec ses categories.' },
      '400': { description: 'Donnees invalides.' },
      '401': { description: 'Non connecte.' },
      '403': { description: 'Role non autorise.' },
    },
    $global: {
      components: {
        schemas: {
          CategoryInput: {
            type: 'object',
            required: ['name', 'totalPlaces', 'price'],
            properties: {
              name: { type: 'string', maxLength: 80 },
              totalPlaces: { type: 'integer', minimum: 1, maximum: 100000 },
              price: { type: 'number', minimum: 0, description: 'Prix normal en euros.' },
              earlyPrice: { type: 'number', minimum: 0, description: 'Prix early en euros (inferieur au prix normal).' },
              earlyUntil: { type: 'string', format: 'date-time', description: 'Fin du tarif early (UTC), avant le concert.' },
            },
          },
        },
      },
    },
  },
})

interface CreateEventBody {
  name?: string
  eventDate?: string
  categories?: CategoryInput[]
}

const MAX_CATEGORIES = 20

// Creation d'un concert AVEC ses categories, dans une seule ecriture : un
// concert ne peut pas exister sans au moins une categorie de billets.
// ORGANIZER et ADMIN en deviennent proprietaires.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ORGANIZER', 'ADMIN')
  const body = await readBody<CreateEventBody>(event)

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Nom du concert requis (120 caracteres max).' })
  }

  const eventDate = parseUtcDate(body?.eventDate)
  if (!eventDate || eventDate <= new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Date du concert (UTC) valide et future requise.' })
  }

  const rawCategories = Array.isArray(body?.categories) ? body.categories : []
  if (rawCategories.length < 1 || rawCategories.length > MAX_CATEGORIES) {
    throw createError({
      statusCode: 400,
      statusMessage: `Un concert doit avoir entre 1 et ${MAX_CATEGORIES} categories.`,
    })
  }
  const categories = rawCategories.map((c) => parseCategoryInput(c, eventDate))
  const names = new Set(categories.map((c) => c.name.toLowerCase()))
  if (names.size !== categories.length) {
    throw createError({ statusCode: 400, statusMessage: 'Deux categories portent le meme nom.' })
  }

  const created = await prisma.event.create({
    data: { name, eventDate, ownerId: user.id, categories: { create: categories } },
    include: { categories: true },
  })
  setResponseStatus(event, 201)
  return created
})
