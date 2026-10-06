import QRCode from 'qrcode'

// Genere l'image QR (signee HMAC, section 2.3) du billet a la volee, sans
// la stocker : seul le token signe est persiste en base (`qrToken`).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id de reservation manquant.' })

  const reservation = await prisma.reservation.findUnique({ where: { id } })
  if (!reservation) throw createError({ statusCode: 404, statusMessage: 'Reservation introuvable.' })
  if (reservation.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: "Ce billet n'appartient pas a votre compte." })
  }
  if (reservation.status === 'CANCELLED' || reservation.status === 'EXPIRED') {
    throw createError({ statusCode: 410, statusMessage: 'Billet annule ou expire.' })
  }

  const png = await QRCode.toBuffer(reservation.qrToken, { type: 'png', width: 320, margin: 1 })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'no-store')
  return png
})
