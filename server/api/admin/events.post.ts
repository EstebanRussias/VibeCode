interface CreateEventBody {
  name?: string
  eventDate?: string
}

// Creation d'un concert : ouvert a ADMIN et SUPERADMIN, qui en deviennent
// proprietaires (seul un SUPERADMIN pourra ensuite le modifier a leur place).
export default defineEventHandler(async (event) => {
  const user = await requireAnyAdmin(event)
  const body = await readBody<CreateEventBody>(event)
  const name = body?.name?.trim()
  const eventDate = body?.eventDate ? new Date(body.eventDate) : null

  if (!name || !eventDate || Number.isNaN(eventDate.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'name et eventDate (date valide) sont requis.' })
  }

  const created = await prisma.event.create({ data: { name, eventDate, ownerId: user.id } })
  setResponseStatus(event, 201)
  return created
})
