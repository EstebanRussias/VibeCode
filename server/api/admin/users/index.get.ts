defineRouteMeta({
  openAPI: {
    tags: ['Admin'],
    summary: '[ADMIN] Liste des comptes',
    description: '**Roles autorises :** ADMIN.\n\nTous les comptes avec leur nombre de concerts organises et de reservations.',
    security: [{ cookieAuth: [] }],
    responses: { '200': { description: 'Liste des comptes.' }, '401': { description: 'Non connecte.' }, '403': { description: 'Role non autorise.' }, },
  },
})

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
