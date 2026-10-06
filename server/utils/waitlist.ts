import { randomUUID } from 'node:crypto'
import type { PrismaTx } from './prisma'
import { signReservationToken } from './qrToken'

// Fenetre d'achat exclusive temporisee (section 2.4).
const HOLD_WINDOW_MS = 2 * 60 * 60 * 1000

// Sweep paresseux : pas de worker/cron pour ce POC, on expire les HELD en
// retard a chaque fois qu'on touche la categorie concernee (reservation,
// annulation, listing des evenements).
export async function expireStaleHolds(tx: PrismaTx, ticketCategoryId: string) {
  const staleHolds = await tx.reservation.findMany({
    where: { ticketCategoryId, status: 'HELD', holdExpiresAt: { lt: new Date() } },
  })

  for (const hold of staleHolds) {
    await tx.reservation.update({ where: { id: hold.id }, data: { status: 'EXPIRED' } })
    await tx.ticketCategory.update({
      where: { id: ticketCategoryId },
      data: { placesDisponibles: { increment: hold.quantity } },
    })
    await tx.waitlistEntry.updateMany({
      where: { reservationId: hold.id, status: 'NOTIFIED' },
      data: { status: 'EXPIRED' },
    })
    // La place liberee par l'expiration revient dans le pot commun : on
    // notifie le suivant de la file (cascade FIFO).
    await processWaitlistForCategory(tx, ticketCategoryId)
  }
}

export async function processWaitlistForCategory(tx: PrismaTx, ticketCategoryId: string) {
  const category = await tx.ticketCategory.findUniqueOrThrow({ where: { id: ticketCategoryId } })
  if (category.placesDisponibles < 1) return null

  const nextInLine = await tx.waitlistEntry.findFirst({
    where: { ticketCategoryId, status: 'WAITING' },
    orderBy: { createdAt: 'asc' },
  })
  if (!nextInLine) return null

  await tx.ticketCategory.update({
    where: { id: ticketCategoryId },
    data: { placesDisponibles: { decrement: 1 } },
  })

  const reservationId = randomUUID()
  const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS)

  const reservation = await tx.reservation.create({
    data: {
      id: reservationId,
      ticketCategoryId,
      userId: nextInLine.userId,
      email: nextInLine.email,
      quantity: 1,
      status: 'HELD',
      idempotencyKey: `waitlist-${nextInLine.id}`,
      qrToken: signReservationToken(reservationId),
      holdExpiresAt,
    },
  })

  await tx.waitlistEntry.update({
    where: { id: nextInLine.id },
    data: { status: 'NOTIFIED', notifiedAt: new Date(), reservationId: reservation.id },
  })

  // Notification simulee en console pour le POC (section 2.4) — brancher
  // Resend/Twilio ne change pas la logique metier ci-dessus.
  console.log(
    `[waitlist] Place liberee pour ${nextInLine.email} — a confirmer avant ${holdExpiresAt.toISOString()} (reservation ${reservation.id})`
  )

  return reservation
}
