interface WaitlistBody {
  ticketCategoryId?: string
}

// Inscription a la liste d'attente FIFO (section 2.4), liee au compte connecte.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<WaitlistBody>(event)
  const ticketCategoryId = body?.ticketCategoryId

  if (!ticketCategoryId) {
    throw createError({ statusCode: 400, statusMessage: 'ticketCategoryId est requis.' })
  }

  const entry = await prisma.$transaction(async (tx) => {
    const category = await tx.ticketCategory.findUnique({ where: { id: ticketCategoryId } })
    if (!category) throw createError({ statusCode: 404, statusMessage: 'Categorie introuvable.' })

    const existing = await tx.waitlistEntry.findFirst({
      where: { ticketCategoryId, userId: user.id, status: { in: ['WAITING', 'NOTIFIED'] } },
    })
    if (existing) return existing

    return tx.waitlistEntry.create({
      data: { ticketCategoryId, userId: user.id, email: user.email },
    })
  })

  setResponseStatus(event, 201)
  return entry
})
