import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from '../server/utils/password'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// SUPERADMIN : gere tous les concerts, y compris ceux des autres admins,
// et peut supprimer n'importe quel billet.
const SUPERADMIN_EMAIL = 'admin@nuits-garonne.fr'
const SUPERADMIN_PASSWORD = 'admin1234'

// ADMIN "ordinaire" : ne peut creer/modifier/supprimer que ses propres
// concerts (utile pour tester la restriction d'ownership).
const ADMIN_EMAIL = 'organisateur@nuits-garonne.fr'
const ADMIN_PASSWORD = 'admin1234'

const DAY_MS = 24 * 60 * 60 * 1000

interface SeedCategory {
  id: string
  name: string
  totalPlaces: number
}

interface SeedEvent {
  id: string
  name: string
  daysFromNow: number
  owner: 'super' | 'admin'
  categories: SeedCategory[]
}

const events: SeedEvent[] = [
  {
    id: 'demo-event',
    name: 'Nuit de la Garonne — Concert de demonstration',
    daysFromNow: 30,
    owner: 'super',
    categories: [
      // Stocks volontairement petits pour demontrer facilement l'anti-survente
      // avec scripts/demo-concurrency.mjs.
      { id: 'demo-fosse', name: 'Fosse', totalPlaces: 3 },
      { id: 'demo-balcon', name: 'Balcon', totalPlaces: 5 },
    ],
  },
  {
    id: 'electro-hangar',
    name: 'Soiree Electro au Hangar',
    daysFromNow: 15,
    owner: 'super',
    categories: [
      { id: 'electro-fosse', name: 'Fosse', totalPlaces: 50 },
      { id: 'electro-vip', name: 'VIP', totalPlaces: 10 },
    ],
  },
  {
    id: 'jazz-blues',
    name: 'Nuit Jazz & Blues',
    daysFromNow: 45,
    owner: 'super',
    categories: [
      { id: 'jazz-libre', name: 'Placement libre', totalPlaces: 100 },
      { id: 'jazz-carre-or', name: 'Carre Or', totalPlaces: 20 },
    ],
  },
  {
    id: 'scene-acoustique',
    name: 'Scene Ouverte Acoustique',
    daysFromNow: 5,
    owner: 'admin',
    categories: [{ id: 'acoustique-standard', name: 'Standard', totalPlaces: 80 }],
  },
  {
    id: 'hommage-rock',
    name: 'Concert Hommage Rock',
    // Dans moins de 48h : utile pour tester le refus d'annulation (module 6).
    daysFromNow: 1,
    owner: 'admin',
    categories: [
      // Stock minuscule pour tester facilement la liste d'attente FIFO (2.4).
      { id: 'rock-fosse', name: 'Fosse', totalPlaces: 2 },
    ],
  },
]

async function main() {
  const superAdmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { role: 'SUPERADMIN' },
    create: {
      email: SUPERADMIN_EMAIL,
      passwordHash: await hashPassword(SUPERADMIN_PASSWORD),
      role: 'SUPERADMIN',
    },
  })
  console.log(`Seed OK : compte super-admin (${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD})`)

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: 'ADMIN',
    },
  })
  console.log(`Seed OK : compte admin (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`)

  const ownerIdByRole = { super: superAdmin.id, admin: admin.id }

  for (const eventSeed of events) {
    const event = await prisma.event.upsert({
      where: { id: eventSeed.id },
      update: { ownerId: ownerIdByRole[eventSeed.owner] },
      create: {
        id: eventSeed.id,
        name: eventSeed.name,
        eventDate: new Date(Date.now() + eventSeed.daysFromNow * DAY_MS),
        ownerId: ownerIdByRole[eventSeed.owner],
      },
    })

    for (const category of eventSeed.categories) {
      await prisma.ticketCategory.upsert({
        where: { id: category.id },
        update: {},
        create: {
          id: category.id,
          eventId: event.id,
          name: category.name,
          totalPlaces: category.totalPlaces,
          placesDisponibles: category.totalPlaces,
        },
      })
    }

    console.log('Seed OK :', event.name, `(proprietaire : ${eventSeed.owner})`)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
