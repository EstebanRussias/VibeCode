// Page gestionnaire : liste des comptes. ADMIN uniquement (403 sinon).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  return prisma.user.findMany({
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { ownedEvents: true, reservations: true } },
    },
  })
})
