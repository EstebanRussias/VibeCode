defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    summary: '[Public] Utilisateur connecte',
    description: '**Roles autorises :** public (aucune connexion requise).\n\nRenvoie le compte de la session courante, ou null si non connecte.',
    security: [],
    responses: { '200': { description: 'Utilisateur (id, email, name, role) ou null.' } },
  },
})

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) return null
  return publicUser(user)
})
