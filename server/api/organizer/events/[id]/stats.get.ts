interface CategoryRevenueRow {
  categoryId: string
  categoryName: string
  totalPlaces: number
  placesDisponibles: number
  priceCents: number
  earlyPriceCents: number | null
  ticketsSold: bigint
  earlyTicketsSold: bigint
  ticketsScanned: bigint
  revenueCents: bigint
}

// Recettes du concert par categorie, lues dans la vue SQL "CategoryRevenue"
// (migration roles_prices_stats). Organisateur du concert ou ADMIN.
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: "Id d'evenement manquant." })

  const target = await prisma.event.findUnique({ where: { id: eventId } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Evenement introuvable.' })

  await requireEventManager(event, target.ownerId)

  const rows = await prisma.$queryRaw<CategoryRevenueRow[]>`
    SELECT "categoryId", "categoryName", "totalPlaces", "placesDisponibles", "priceCents", "earlyPriceCents",
           "ticketsSold", "earlyTicketsSold", "ticketsScanned", "revenueCents"
    FROM "CategoryRevenue"
    WHERE "eventId" = ${eventId}
    ORDER BY "priceCents" ASC
  `

  // bigint (SUM Postgres) -> number pour la serialisation JSON.
  const categories = rows.map((r) => ({
    ...r,
    ticketsSold: Number(r.ticketsSold),
    earlyTicketsSold: Number(r.earlyTicketsSold),
    ticketsScanned: Number(r.ticketsScanned),
    revenueCents: Number(r.revenueCents),
  }))

  return {
    eventId,
    eventName: target.name,
    categories,
    totals: {
      ticketsSold: categories.reduce((sum, c) => sum + c.ticketsSold, 0),
      ticketsScanned: categories.reduce((sum, c) => sum + c.ticketsScanned, 0),
      revenueCents: categories.reduce((sum, c) => sum + c.revenueCents, 0),
    },
  }
})
