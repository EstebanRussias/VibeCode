// Billets lies au compte connecte : persistent en base, donc visibles
// meme apres un rafraichissement de page ou une reconnexion.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'USER')

  return prisma.reservation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      ticketCategory: {
        select: { name: true, event: { select: { name: true, eventDate: true, owner: { select: { name: true } } } } },
      },
    },
  })
})
