export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) return null
  return publicUser(user)
})
