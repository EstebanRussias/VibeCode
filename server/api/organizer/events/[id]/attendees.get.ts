// Export CSV des participants du concert (billets confirmes) : liste de
// controle pour l'organisateur du concert ou un ADMIN.
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: "Id d'evenement manquant." })

  const target = await prisma.event.findUnique({ where: { id: eventId } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Evenement introuvable.' })

  await requireEventManager(event, target.ownerId)

  const reservations = await prisma.reservation.findMany({
    where: { status: 'CONFIRMED', ticketCategory: { eventId } },
    orderBy: [{ ticketCategory: { name: 'asc' } }, { createdAt: 'asc' }],
    include: { user: { select: { name: true } }, ticketCategory: { select: { name: true } } },
  })

  const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
  const utc = (date: Date | null) => (date ? date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '')

  const csv = toCsv(
    ['Nom', 'Email', 'Categorie', 'Quantite', 'Prix unitaire (EUR)', 'Tarif', 'Total (EUR)', 'Reserve le', 'Scanne le', 'Billet'],
    reservations.map((r) => [
      r.user.name,
      r.email,
      r.ticketCategory.name,
      r.quantity,
      euros(r.unitPriceCents),
      r.isEarly ? 'Early' : 'Normal',
      euros(r.unitPriceCents * r.quantity),
      utc(r.createdAt),
      utc(r.scannedAt),
      r.id,
    ])
  )

  const slug = target.name.normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'concert'
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="participants-${slug}.csv"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return csv
})
