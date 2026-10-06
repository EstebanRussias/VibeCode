defineRouteMeta({
  openAPI: {
    tags: ['Organisateur'],
    summary: '[ORGANIZER, ADMIN] Concerts geres',
    description:
      '**Roles autorises :** ORGANIZER (uniquement ses propres concerts), ADMIN (tous les concerts).',
    security: [{ cookieAuth: [] }],
    responses: { '200': { description: 'Liste des concerts avec leurs categories.' }, '401': { description: 'Non connecte.' }, '403': { description: 'Role non autorise.' }, },
  },
})

// Concerts geres par le compte connecte : les siens pour un ORGANIZER,
// tous (avec le nom de l'organisateur) pour un ADMIN.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ORGANIZER', 'ADMIN')

  const events = await prisma.event.findMany({
    where: user.role === 'ADMIN' ? {} : { ownerId: user.id },
    orderBy: { eventDate: 'asc' },
    include: {
      categories: { orderBy: { priceCents: 'asc' } },
      owner: { select: { id: true, name: true } },
    },
  })

  return events.map((e) => ({
    id: e.id,
    name: e.name,
    eventDate: e.eventDate,
    organizer: e.owner,
    categories: e.categories.map((c) => ({
      id: c.id,
      name: c.name,
      totalPlaces: c.totalPlaces,
      placesDisponibles: c.placesDisponibles,
      priceCents: c.priceCents,
      earlyPriceCents: c.earlyPriceCents,
      earlyUntil: c.earlyUntil,
    })),
  }))
})
