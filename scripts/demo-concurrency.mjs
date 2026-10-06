// Demonstration de l'anti-survente (section 2.1) : envoie N requetes de
// reservation concurrentes sur une categorie qui n'a que 3 places (seed),
// et verifie qu'exactement 3 reussissent, jamais plus.
//
// Usage : npm run demo:concurrency [-- <baseUrl> <categoryId> <concurrency>]
// Les reservations sont reservees aux acheteurs (USER) : le script se
// connecte avec le compte de demo du seed. Avec quantity = 1, le quota de 4
// billets par compte reste au-dessus du stock de "demo-fosse" (3 places).

const baseUrl = process.argv[2] ?? 'http://localhost:3000'
const ticketCategoryId = process.argv[3] ?? 'demo-fosse'
const concurrency = Number(process.argv[4] ?? 10)

function randomId() {
  return crypto.randomUUID()
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client@nuits-garonne.fr', password: 'client1234' }),
  })
  if (!response.ok) throw new Error(`Connexion du compte de demo impossible (${response.status})`)
  return response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}

async function attemptReservation(index, cookie) {
  const response = await fetch(`${baseUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      ticketCategoryId,
      quantity: 1,
      idempotencyKey: randomId(),
    }),
  })
  return { index, status: response.status, body: await response.json().catch(() => null) }
}

async function main() {
  console.log(`Envoi de ${concurrency} reservations concurrentes sur "${ticketCategoryId}"...`)

  const cookie = await login()
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) => attemptReservation(i, cookie))
  )

  const succeeded = results.filter((r) => r.status === 201)
  const soldOut = results.filter((r) => r.status === 409 || r.status === 422)
  const other = results.filter((r) => r.status !== 201 && r.status !== 409)

  console.log(`\nReussies (201) : ${succeeded.length}`)
  console.log(`Refusees "sold out" / quota (409/422) : ${soldOut.length}`)
  if (other.length) {
    console.log(`Autres reponses inattendues : ${other.length}`)
    other.forEach((r) => console.log(`  - #${r.index}: ${r.status}`, r.body))
  }

  console.log('\nAucune survente si "Reussies" == le stock initial de la categorie.')
}

main().catch((error) => {
  console.error('Le script a echoue — verifie que le serveur tourne et que la base est seedee.')
  console.error(error)
  process.exit(1)
})
