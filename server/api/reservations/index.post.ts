import { randomUUID } from 'node:crypto'

const configuredMax = Number(process.env.MAX_TICKETS_PER_EMAIL)
const MAX_TICKETS_PER_USER = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 4

interface ReservationBody {
  ticketCategoryId?: string
  quantity?: number
  idempotencyKey?: string
}

// Coeur du POC (section 2.1 + 2.2) : une transaction unique verrouille la
// ligne de stock (SELECT ... FOR UPDATE), verifie la disponibilite et le
// quota anti-bot, puis cree directement une reservation CONFIRMED liee au
// compte connecte, au prix applicable (early ou normal). La cle
// d'idempotence cote client empeche les doublons issus d'un double-clic ou
// d'un retry reseau. Reserve aux acheteurs (USER).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'USER')
  const body = await readBody<ReservationBody>(event)

  const ticketCategoryId = body?.ticketCategoryId
  const quantity = Number(body?.quantity)
  const idempotencyKey = body?.idempotencyKey

  if (
    typeof ticketCategoryId !== 'string' ||
    typeof idempotencyKey !== 'string' ||
    !idempotencyKey ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ticketCategoryId, quantity (entier >= 1) et idempotencyKey sont requis.',
    })
  }

  // La cle d'idempotence ne rejoue que les reservations du meme compte :
  // sinon connaitre la cle d'un autre suffirait a recuperer son billet.
  function replayOwn(existing: { userId: string }) {
    if (existing.userId !== user.id) {
      throw createError({ statusCode: 409, statusMessage: "Cle d'idempotence deja utilisee." })
    }
    return existing
  }

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findUnique({ where: { idempotencyKey } })
      if (existing) return replayOwn(existing)

      const rows = await tx.$queryRaw<
        {
          id: string
          placesDisponibles: number
          priceCents: number
          earlyPriceCents: number | null
          earlyUntil: Date | null
          eventDate: Date
        }[]
      >`
        SELECT c.id, c."placesDisponibles", c."priceCents", c."earlyPriceCents", c."earlyUntil", e."eventDate"
        FROM "TicketCategory" c JOIN "Event" e ON e.id = c."eventId"
        WHERE c.id = ${ticketCategoryId}
        FOR UPDATE OF c
      `
      const category = rows[0]
      if (!category) {
        throw createError({ statusCode: 404, statusMessage: 'Categorie de billet introuvable.' })
      }
      if (category.eventDate <= new Date()) {
        throw createError({ statusCode: 410, statusMessage: 'Ce concert est deja passe.' })
      }

      // Apres le verrou : les holds expires sont rendus au stock sans course.
      await expireStaleHolds(tx, ticketCategoryId)
      const { placesDisponibles } = await tx.ticketCategory.findUniqueOrThrow({
        where: { id: ticketCategoryId },
        select: { placesDisponibles: true },
      })

      const confirmedForUser = await tx.reservation.aggregate({
        _sum: { quantity: true },
        where: { ticketCategoryId, userId: user.id, status: { in: ['CONFIRMED', 'HELD'] } },
      })
      const alreadyHeld = confirmedForUser._sum.quantity ?? 0
      if (alreadyHeld + quantity > MAX_TICKETS_PER_USER) {
        throw createError({
          statusCode: 422,
          statusMessage: `Quota depasse : ${MAX_TICKETS_PER_USER} billets maximum par compte pour cette categorie.`,
        })
      }

      if (placesDisponibles < quantity) {
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

      const { unitPriceCents, isEarly } = currentPrice(category)
      const reservationId = randomUUID()
      return tx.reservation.create({
        data: {
          id: reservationId,
          ticketCategoryId,
          userId: user.id,
          email: user.email,
          quantity,
          unitPriceCents,
          isEarly,
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
      if (existing) return replayOwn(existing)
    }
    throw error
  }
})
