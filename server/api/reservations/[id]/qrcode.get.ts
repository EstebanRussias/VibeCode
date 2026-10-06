import QRCode from 'qrcode'

defineRouteMeta({
  openAPI: {
    tags: ['Reservations'],
    summary: '[USER] QR code d\'un billet',
    description: '**Roles autorises :** USER (uniquement ses propres billets).\n\nImage PNG du QR signe, billet confirme uniquement.',
    security: [{ cookieAuth: [] }],
    responses: {
      '200': { description: 'Image PNG.', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } },
      '401': { description: 'Non connecte.' },
      '403': { description: 'Role non autorise.' },
      '404': { description: 'Reservation introuvable (ou billet d\'un autre compte).' },
      '410': { description: 'Billet non confirme, annule ou expire.' },
    },
  },
})

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

  const png = await QRCode.toBuffer(reservation.qrToken, { type: 'png', width: CONFIG.qrCode.widthPx, margin: CONFIG.qrCode.marginModules })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'no-store')
  return png
})
