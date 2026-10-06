// Demonstration de l'anti-survente (section 2.1) : envoie N requetes de
// reservation concurrentes sur une categorie qui n'a que 3 places (seed),
// et verifie qu'exactement 3 reussissent, jamais plus.
//
// Usage : npm run demo:concurrency [-- <baseUrl> <categoryId> <concurrency>]

const baseUrl = process.argv[2] ?? 'http://localhost:3000'
const ticketCategoryId = process.argv[3] ?? 'demo-fosse'
const concurrency = Number(process.argv[4] ?? 10)

function randomId() {
  return crypto.randomUUID()
}

async function attemptReservation(index) {
  const response = await fetch(`${baseUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticketCategoryId,
      email: `demo-${index}-${randomId()}@example.com`,
      quantity: 1,
      idempotencyKey: randomId(),
    }),
  })
  return { index, status: response.status, body: await response.json().catch(() => null) }
}

async function main() {
  console.log(`Envoi de ${concurrency} reservations concurrentes sur "${ticketCategoryId}"...`)

  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) => attemptReservation(i))
  )

  const succeeded = results.filter((r) => r.status === 201)
  const soldOut = results.filter((r) => r.status === 409)
  const other = results.filter((r) => r.status !== 201 && r.status !== 409)

  console.log(`\nReussies (201) : ${succeeded.length}`)
  console.log(`Refusees "sold out" (409) : ${soldOut.length}`)
  if (other.length) {
    console.log(`Autres reponses inattendues : ${other.length}`)
    other.forEach((r) => console.log(`  - #${r.index}: ${r.status}`, r.body))
  }

  console.log('\nAucune survente si "Reussies" == le stock initial de la categorie.')
}

main().catch((error) => {
  console.error('Le script a echoue — verifie que `npm run dev` tourne et que la base est seedee.')
  console.error(error)
  process.exit(1)
})
