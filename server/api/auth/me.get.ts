export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) return null
  return { id: user.id, email: user.email, role: user.role }
})
