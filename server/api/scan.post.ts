interface ScanBody {
  qrToken?: string
  scannedBy?: string
}

// Scanner de controle (section 2.3, version en ligne du POC) : verifie la
// signature HMAC du QR puis marque le billet scanne dans la meme
// transaction, avec alerte si deja scanne (anti-fraude capture d'ecran).
export default defineEventHandler(async (event) => {
  const body = await readBody<ScanBody>(event)
  const qrToken = body?.qrToken?.trim()
  if (!qrToken) throw createError({ statusCode: 400, statusMessage: 'qrToken manquant.' })

  const { valid, reservationId } = verifyReservationToken(qrToken)
  if (!valid || !reservationId) {
    return { result: 'INVALID' as const, message: 'QR code invalide ou falsifie.' }
  }

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } })
    if (!reservation || reservation.qrToken !== qrToken) {
      return { result: 'INVALID' as const, message: 'Billet introuvable.' }
    }
    if (reservation.status !== 'CONFIRMED') {
      return { result: 'INVALID' as const, message: `Billet ${reservation.status.toLowerCase()}, entree refusee.` }
    }
    if (reservation.scannedAt) {
      return {
        result: 'ALREADY_SCANNED' as const,
        message: `Deja scanne le ${reservation.scannedAt.toLocaleString('fr-FR')}${
          reservation.scannedBy ? ' par ' + reservation.scannedBy : ''
        }.`,
      }
    }

    const scanned = await tx.reservation.update({
      where: { id: reservation.id },
      data: { scannedAt: new Date(), scannedBy: body?.scannedBy?.trim() || null },
    })

    return { result: 'OK' as const, message: 'Acces autorise.', reservation: scanned }
  })
})
