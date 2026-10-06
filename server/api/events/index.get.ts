// Liste les evenements et la disponibilite de chaque categorie de billet.
// Balaye au passage les reservations HELD en retard (section 2.4) pour que
// le stock affiche soit toujours a jour, sans worker/cron dedie.
export default defineEventHandler(async () => {
  const categories = await prisma.ticketCategory.findMany({ select: { id: true } })
  for (const category of categories) {
    await prisma.$transaction((tx) => expireStaleHolds(tx, category.id))
  }

  const events = await prisma.event.findMany({
    orderBy: { eventDate: 'asc' },
    include: { categories: true, owner: { select: { email: true } } },
  })

  const waitlistCounts = await prisma.waitlistEntry.groupBy({
    by: ['ticketCategoryId'],
    where: { status: 'WAITING' },
    _count: { _all: true },
  })
  const waitlistCountByCategory = new Map(waitlistCounts.map((w) => [w.ticketCategoryId, w._count._all]))

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    eventDate: event.eventDate,
    ownerId: event.ownerId,
    ownerEmail: event.owner.email,
    categories: event.categories.map((category) => ({
      id: category.id,
      name: category.name,
      totalPlaces: category.totalPlaces,
      placesDisponibles: category.placesDisponibles,
      waitlistCount: waitlistCountByCategory.get(category.id) ?? 0,
    })),
  }))
})
