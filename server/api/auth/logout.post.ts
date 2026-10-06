export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } })
  }
  clearSessionCookie(event)
  return { ok: true }
})
