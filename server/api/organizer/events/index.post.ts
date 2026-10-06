import type { CategoryInput } from '../../../utils/categories'

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
