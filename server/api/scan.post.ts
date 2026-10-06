interface ScanBody {
  qrToken?: string
  scannedBy?: string
}

// Scanner de controle (section 2.3, version en ligne du POC) : reserve a
// l'organisateur du concert et aux admins. Verifie la signature HMAC du QR
// puis marque le billet scanne de facon atomique, avec alerte si deja
// scanne (anti-fraude capture d'ecran).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ORGANIZER', 'ADMIN')
  const body = await readBody<ScanBody>(event)
  const qrToken = typeof body?.qrToken === 'string' ? body.qrToken.trim() : ''
  if (!qrToken) throw createError({ statusCode: 400, statusMessage: 'qrToken manquant.' })

  const { valid, reservationId } = verifyReservationToken(qrToken)
  if (!valid || !reservationId) {
    return { result: 'INVALID' as const, message: 'QR code invalide ou falsifie.' }
  }

  // Le poste de scan est libre (ex. "Guichet 2") mais toujours rattache au
  // compte qui scanne : la trace d'audit n'est pas falsifiable.
  const station = typeof body?.scannedBy === 'string' ? body.scannedBy.trim().slice(0, 40) : ''
  const scannedBy = station ? `${user.name} (${station})` : user.name

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { ticketCategory: { include: { event: true } }, user: { select: { name: true } } },
  })
  if (!reservation || reservation.qrToken !== qrToken) {
    return { result: 'INVALID' as const, message: 'Billet introuvable.' }
  }
  const concert = reservation.ticketCategory.event
  if (user.role !== 'ADMIN' && concert.ownerId !== user.id) {
    return { result: 'INVALID' as const, message: "Ce billet n'est pas pour un de vos concerts." }
  }
  if (reservation.status !== 'CONFIRMED') {
    return { result: 'INVALID' as const, message: `Billet ${reservation.status.toLowerCase()}, entree refusee.` }
  }

  // UPDATE conditionnel : deux scans simultanes du meme QR (capture d'ecran
  // presentee a deux entrees) -> un seul obtient count = 1.
  const { count } = await prisma.reservation.updateMany({
    where: { id: reservation.id, status: 'CONFIRMED', scannedAt: null },
    data: { scannedAt: new Date(), scannedBy },
  })
  if (count === 0) {
    const latest = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })
    return {
      result: 'ALREADY_SCANNED' as const,
      message: `Deja scanne le ${latest.scannedAt?.toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC${
        latest.scannedBy ? ' par ' + latest.scannedBy : ''
      }.`,
    }
  }

  return {
    result: 'OK' as const,
    message: `Acces autorise : ${reservation.user.name} — ${concert.name}, ${reservation.ticketCategory.name} x${reservation.quantity}.`,
  }
})
