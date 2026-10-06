defineRouteMeta({
  openAPI: {
    tags: ['Catalogue'],
    summary: '[USER] Catalogue des concerts a venir',
    description:
      '**Roles autorises :** USER.\n\nConcerts a venir avec, par categorie, le prix applicable (early ou normal), les places disponibles et la taille de la liste d\'attente.',
    security: [{ cookieAuth: [] }],
    responses: { '200': { description: 'Liste des concerts.' }, '401': { description: 'Non connecte.' }, '403': { description: 'Role non autorise.' }, },
  },
})

// Catalogue acheteur (USER) : concerts a venir, prix applicable (early ou
// normal) et disponibilite de chaque categorie. Balaye au passage les
// reservations HELD en retard (section 2.4) pour que le stock affiche soit
// a jour, sans worker/cron dedie.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'USER')

  const now = new Date()
  const staleCategories = await prisma.reservation.findMany({
    where: { status: 'HELD', holdExpiresAt: { lt: now } },
    select: { ticketCategoryId: true },
    distinct: ['ticketCategoryId'],
  })
  for (const { ticketCategoryId } of staleCategories) {
    await prisma.$transaction((tx) => expireStaleHolds(tx, ticketCategoryId))
  }

  const events = await prisma.event.findMany({
    where: { eventDate: { gt: now } },
    orderBy: { eventDate: 'asc' },
    include: { categories: { orderBy: { priceCents: 'asc' } }, owner: { select: { name: true } } },
  })

  const waitlistCounts = await prisma.waitlistEntry.groupBy({
    by: ['ticketCategoryId'],
    where: { status: 'WAITING' },
    _count: { _all: true },
  })
  const waitlistCountByCategory = new Map(waitlistCounts.map((w) => [w.ticketCategoryId, w._count._all]))

  // Nom de l'organisateur seulement (pas son email : evite d'exposer les
  // identifiants de connexion des comptes a privileges).
  return events.map((e) => ({
    id: e.id,
    name: e.name,
    eventDate: e.eventDate,
    organizerName: e.owner.name,
    categories: e.categories.map((category) => ({
      id: category.id,
      name: category.name,
      totalPlaces: category.totalPlaces,
      placesDisponibles: category.placesDisponibles,
      priceCents: category.priceCents,
      earlyPriceCents: category.earlyPriceCents,
      earlyUntil: category.earlyUntil,
      ...currentPrice(category, now),
      waitlistCount: waitlistCountByCategory.get(category.id) ?? 0,
    })),
  }))
})
