import QRCode from 'qrcode'

// Genere l'image QR (signee HMAC, section 2.3) du billet a la volee, sans
// la stocker : seul le token signe est persiste en base (`qrToken`).
// Uniquement pour le titulaire du billet.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'USER')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id de reservation manquant.' })

  const reservation = await prisma.reservation.findUnique({ where: { id } })
  if (!reservation || reservation.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Reservation introuvable.' })
  }
  if (reservation.status !== 'CONFIRMED') {
    throw createError({ statusCode: 410, statusMessage: 'Billet non confirme, annule ou expire.' })
  }

  const png = await QRCode.toBuffer(reservation.qrToken, { type: 'png', width: 320, margin: 1 })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'no-store')
  return png
})
