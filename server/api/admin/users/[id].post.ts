import type { Role } from '../../../utils/session'

interface UpdateUserBody {
  name?: string
  role?: string
}

// Page gestionnaire : modifie le nom et/ou le role d'un compte.
// ADMIN uniquement (403 sinon). Le role est relu en base a chaque requete,
// donc le changement s'applique immediatement aux sessions ouvertes.
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Id utilisateur manquant.' })

  const body = await readBody<UpdateUserBody>(event)
  const data: { name?: string; role?: Role } = {}

  if (body?.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 80) {
      throw createError({ statusCode: 400, statusMessage: 'Nom requis (80 caracteres max).' })
    }
    data.name = name
  }

  if (body?.role !== undefined) {
    if (!ROLES.includes(body.role as Role)) {
      throw createError({ statusCode: 400, statusMessage: `Role invalide (${ROLES.join(', ')}).` })
    }
    // Evite qu'un admin se retire ses propres droits et verrouille la gestion.
    if (id === admin.id && body.role !== 'ADMIN') {
      throw createError({ statusCode: 409, statusMessage: 'Vous ne pouvez pas retirer votre propre role admin.' })
    }
    data.role = body.role as Role
  }

  if (!data.name && !data.role) {
    throw createError({ statusCode: 400, statusMessage: 'Rien a modifier (name et/ou role).' })
  }

  const target = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { ownedEvents: true } } } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Utilisateur introuvable.' })

  // Un compte qui organise des concerts doit garder un role gestionnaire,
  // sinon ses concerts n'auraient plus personne d'autre que l'admin.
  if (data.role === 'USER' && target._count.ownedEvents > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Ce compte organise ${target._count.ownedEvents} concert(s) : supprimez-les avant de le repasser USER.`,
    })
  }

  const updated = await prisma.user.update({ where: { id }, data })
  return publicUser(updated)
})
