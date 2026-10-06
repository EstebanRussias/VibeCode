defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    summary: '[Public] Deconnexion',
    description: '**Roles autorises :** public (aucune connexion requise).\n\nSupprime la session en base et efface le cookie.',
    security: [],
    responses: { '200': { description: '{ ok: true }' } },
  },
})

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } })
  }
  clearSessionCookie(event)
  return { ok: true }
})
