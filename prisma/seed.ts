import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from '../server/utils/password'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Mots de passe de DEMO uniquement : a ne jamais reutiliser hors poste local.
interface SeedUser {
  key: 'admin' | 'garonne' | 'hangar' | 'client'
  email: string
  name: string
  password: string
  role: 'USER' | 'ORGANIZER' | 'ADMIN'
}

const users: SeedUser[] = [
  // ADMIN : page gestionnaire (noms et roles des comptes), droits sur tous les concerts.
  { key: 'admin', email: 'admin@nuits-garonne.fr', name: 'Admin Garonne', password: 'admin1234', role: 'ADMIN' },
  // Deux ORGANIZER distincts : chacun ne voit et ne gere que ses concerts.
  { key: 'garonne', email: 'organisateur@nuits-garonne.fr', name: 'Garonne Productions', password: 'admin1234', role: 'ORGANIZER' },
  { key: 'hangar', email: 'hangar@nuits-garonne.fr', name: 'Hangar Live', password: 'admin1234', role: 'ORGANIZER' },
  // USER : seul role qui achete des billets.
  { key: 'client', email: 'client@nuits-garonne.fr', name: 'Client Demo', password: 'client1234', role: 'USER' },
]

const DAY_MS = 24 * 60 * 60 * 1000

interface SeedCategory {
  id: string
  name: string
  totalPlaces: number
  price: number
  // Tarif early optionnel, valable jusqu'a J+earlyDays (UTC).
  early?: { price: number; days: number }
}

interface SeedEvent {
  id: string
  name: string
  daysFromNow: number
  owner: SeedUser['key']
  categories: SeedCategory[]
}

const events: SeedEvent[] = [
  {
    id: 'demo-event',
    name: 'Nuit de la Garonne — Concert de demonstration',
    daysFromNow: 30,
    owner: 'garonne',
    categories: [
      // Stocks volontairement petits pour demontrer facilement l'anti-survente
      // avec scripts/demo-concurrency.mjs.
      { id: 'demo-fosse', name: 'Fosse', totalPlaces: 3, price: 25, early: { price: 18, days: 10 } },
      { id: 'demo-balcon', name: 'Balcon', totalPlaces: 5, price: 35 },
    ],
  },
  {
    id: 'electro-hangar',
    name: 'Soiree Electro au Hangar',
    daysFromNow: 15,
    owner: 'hangar',
    categories: [
      { id: 'electro-fosse', name: 'Fosse', totalPlaces: 50, price: 30, early: { price: 22, days: 5 } },
      { id: 'electro-vip', name: 'VIP', totalPlaces: 10, price: 80 },
    ],
  },
  {
    id: 'jazz-blues',
    name: 'Nuit Jazz & Blues',
    daysFromNow: 45,
    owner: 'hangar',
    categories: [
      { id: 'jazz-libre', name: 'Placement libre', totalPlaces: 100, price: 20, early: { price: 15, days: 20 } },
      { id: 'jazz-carre-or', name: 'Carre Or', totalPlaces: 20, price: 55 },
    ],
  },
  {
    id: 'scene-acoustique',
    name: 'Scene Ouverte Acoustique',
    daysFromNow: 5,
    owner: 'garonne',
    categories: [{ id: 'acoustique-standard', name: 'Standard', totalPlaces: 80, price: 12 }],
  },
  {
    id: 'hommage-rock',
    name: 'Concert Hommage Rock',
    // Dans moins de 48h : utile pour tester le refus d'annulation (module 6).
    daysFromNow: 1,
    owner: 'garonne',
    categories: [
      // Stock minuscule pour tester facilement la liste d'attente FIFO (2.4).
      { id: 'rock-fosse', name: 'Fosse', totalPlaces: 2, price: 28 },
    ],
  },
]

// Heure ronde en UTC (20:00) pour des horaires de concert lisibles.
function daysFromNowAt20hUtc(days: number) {
  const date = new Date(Date.now() + days * DAY_MS)
  date.setUTCHours(20, 0, 0, 0)
  return date
}

function categoryPrices(category: SeedCategory) {
  return {
    priceCents: category.price * 100,
    earlyPriceCents: category.early ? category.early.price * 100 : null,
    earlyUntil: category.early ? new Date(Date.now() + category.early.days * DAY_MS) : null,
  }
}

async function main() {
  const idByKey = {} as Record<SeedUser['key'], string>

  for (const seedUser of users) {
    // Upsert : le role et le nom sont remis a jour, le mot de passe n'est
    // jamais ecrase s'il a ete change.
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: { role: seedUser.role, name: seedUser.name },
      create: {
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
        passwordHash: await hashPassword(seedUser.password),
      },
    })
    idByKey[seedUser.key] = user.id
    console.log(`Seed OK : ${seedUser.role} ${seedUser.email} / ${seedUser.password}`)
  }

  for (const eventSeed of events) {
    // Donnees de demo rafraichies seulement si perimees (concert passe) : le
    // seed tourne a chaque demarrage Docker sans decaler les dates.
    const existing = await prisma.event.findUnique({ where: { id: eventSeed.id } })
    const stale = !existing || existing.eventDate <= new Date()
    const eventDate = daysFromNowAt20hUtc(eventSeed.daysFromNow)

    const event = await prisma.event.upsert({
      where: { id: eventSeed.id },
      update: { ownerId: idByKey[eventSeed.owner], ...(stale ? { eventDate } : {}) },
      create: { id: eventSeed.id, name: eventSeed.name, eventDate, ownerId: idByKey[eventSeed.owner] },
    })

    for (const category of eventSeed.categories) {
      const current = await prisma.ticketCategory.findUnique({ where: { id: category.id } })
      // Prix poses a la creation, ou sur les categories d'avant la migration
      // des prix (priceCents = 0), ou quand le concert de demo est relance.
      const refreshPrices = !current || current.priceCents === 0 || stale
      await prisma.ticketCategory.upsert({
        where: { id: category.id },
        update: refreshPrices ? categoryPrices(category) : {},
        create: {
          id: category.id,
          eventId: event.id,
          name: category.name,
          totalPlaces: category.totalPlaces,
          placesDisponibles: category.totalPlaces,
          ...categoryPrices(category),
        },
      })
    }

    console.log('Seed OK :', event.name, `(organisateur : ${eventSeed.owner})`)
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
