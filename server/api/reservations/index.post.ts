import { randomUUID } from 'node:crypto'

const MAX_TICKETS_PER_USER = Number(process.env.MAX_TICKETS_PER_EMAIL ?? 4)

interface ReservationBody {
  ticketCategoryId?: string
  quantity?: number
  idempotencyKey?: string
}

// Coeur du POC (section 2.1 + 2.2) : une transaction unique verrouille la
// ligne de stock (SELECT ... FOR UPDATE), verifie la disponibilite et le
// quota anti-bot, puis cree directement une reservation CONFIRMED liee au
// compte connecte. La cle d'idempotence cote client empeche les doublons
// issus d'un double-clic ou d'un retry reseau.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<ReservationBody>(event)

  const ticketCategoryId = body?.ticketCategoryId
  const quantity = Number(body?.quantity)
  const idempotencyKey = body?.idempotencyKey

  if (!ticketCategoryId || !idempotencyKey || !Number.isInteger(quantity) || quantity < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ticketCategoryId, quantity (entier >= 1) et idempotencyKey sont requis.',
    })
  }

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findUnique({ where: { idempotencyKey } })
      if (existing) return existing

      await expireStaleHolds(tx, ticketCategoryId)

      const rows = await tx.$queryRaw<{ id: string; placesDisponibles: number }[]>`
        SELECT id, "placesDisponibles" FROM "TicketCategory" WHERE id = ${ticketCategoryId} FOR UPDATE
      `
      const category = rows[0]
      if (!category) {
        throw createError({ statusCode: 404, statusMessage: 'Categorie de billet introuvable.' })
      }

      const confirmedForUser = await tx.reservation.aggregate({
        _sum: { quantity: true },
        where: { ticketCategoryId, userId: user.id, status: 'CONFIRMED' },
      })
      const alreadyHeld = confirmedForUser._sum.quantity ?? 0
      if (alreadyHeld + quantity > MAX_TICKETS_PER_USER) {
        throw createError({
          statusCode: 422,
          statusMessage: `Quota depasse : ${MAX_TICKETS_PER_USER} billets maximum par compte pour cette categorie.`,
        })
      }

      if (category.placesDisponibles < quantity) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Plus assez de places disponibles.',
          data: { code: 'SOLD_OUT' },
        })
      }

      await tx.ticketCategory.update({
        where: { id: ticketCategoryId },
        data: { placesDisponibles: { decrement: quantity } },
      })

      const reservationId = randomUUID()
      return tx.reservation.create({
        data: {
          id: reservationId,
          ticketCategoryId,
          userId: user.id,
          email: user.email,
          quantity,
          status: 'CONFIRMED',
          idempotencyKey,
          qrToken: signReservationToken(reservationId),
        },
      })
    })

    setResponseStatus(event, 201)
    return reservation
  } catch (error: any) {
    // Course sur la cle d'idempotence : l'autre requete concurrente a gagne
    // le verrou, cree la reservation puis commit avant que celle-ci ne
    // tente l'insertion -> on renvoie la reservation existante (2.2).
    if (error?.code === 'P2002') {
      const existing = await prisma.reservation.findUnique({ where: { idempotencyKey } })
      if (existing) return existing
    }
    throw error
  }
})
