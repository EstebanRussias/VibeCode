<script setup lang="ts">
definePageMeta({ roles: ['USER'] })

interface TicketCategory {
  id: string
  name: string
  totalPlaces: number
  placesDisponibles: number
  priceCents: number
  earlyPriceCents: number | null
  earlyUntil: string | null
  unitPriceCents: number
  isEarly: boolean
  waitlistCount: number
}

interface EventDto {
  id: string
  name: string
  eventDate: string
  organizerName: string
  categories: TicketCategory[]
}

interface Reservation {
  id: string
  ticketCategoryId: string
  email: string
  quantity: number
  unitPriceCents: number
  isEarly: boolean
  status: 'CONFIRMED' | 'HELD' | 'CANCELLED' | 'EXPIRED'
  idempotencyKey: string
  qrToken: string
  holdExpiresAt: string | null
  ticketCategory: { name: string; event: { name: string; eventDate: string; owner: { name: string } } }
}

const { data: events, refresh, pending } = await useFetch<EventDto[]>('/api/events')
const { data: tickets, refresh: refreshTickets } = await useFetch<Reservation[]>('/api/reservations/mine')

const forms = reactive<Record<string, { quantity: number }>>({})
const errors = reactive<Record<string, string>>({})
const replayResults = reactive<Record<string, boolean>>({})
const holdConfirmId = ref('')
const holdConfirmMessage = ref('')
const pendingAction = reactive<Record<string, boolean>>({})

function formFor(categoryId: string) {
  if (!forms[categoryId]) forms[categoryId] = { quantity: 1 }
  return forms[categoryId]
}

function availabilityRatio(category: TicketCategory) {
  if (category.totalPlaces <= 0) return 0
  return Math.round((category.placesDisponibles / category.totalPlaces) * 100)
}

function availabilityTone(category: TicketCategory) {
  const ratio = availabilityRatio(category)
  if (category.placesDisponibles === 0) return 'danger'
  if (ratio <= CONFIG.ui.lowAvailabilityPercent) return 'warning'
  return 'success'
}

async function reserve(categoryId: string) {
  errors[categoryId] = ''
  pendingAction[categoryId] = true
  const form = formFor(categoryId)
  const idempotencyKey = crypto.randomUUID()

  try {
    await $fetch('/api/reservations', {
      method: 'POST',
      body: { ticketCategoryId: categoryId, quantity: form.quantity, idempotencyKey },
    })
    await Promise.all([refresh(), refreshTickets()])
  } catch (error: any) {
    errors[categoryId] = errorMessage(error)
  } finally {
    pendingAction[categoryId] = false
  }
}

async function joinWaitlist(categoryId: string) {
  errors[categoryId] = ''
  pendingAction[categoryId] = true
  try {
    await $fetch('/api/waitlist', { method: 'POST', body: { ticketCategoryId: categoryId } })
    await refresh()
    errors[categoryId] = "Inscription en liste d'attente confirmee."
  } catch (error: any) {
    errors[categoryId] = errorMessage(error)
  } finally {
    pendingAction[categoryId] = false
  }
}

// Demontre l'idempotence (section 2.2) : renvoie exactement la meme requete
// (meme idempotencyKey) et verifie qu'aucun second billet n'est cree.
async function replay(ticket: Reservation) {
  const replayed = await $fetch<Reservation>('/api/reservations', {
    method: 'POST',
    body: {
      ticketCategoryId: ticket.ticketCategoryId,
      quantity: ticket.quantity,
      idempotencyKey: ticket.idempotencyKey,
    },
  })
  replayResults[ticket.id] = replayed.id === ticket.id
}

async function cancel(ticket: Reservation) {
  try {
    await $fetch(`/api/reservations/${ticket.id}/cancel`, { method: 'POST' })
    await Promise.all([refresh(), refreshTickets()])
  } catch (error: any) {
    alert(errorMessage(error, 'Annulation impossible.'))
  }
}

async function confirmHold(id?: string) {
  const targetId = id || holdConfirmId.value
  holdConfirmMessage.value = ''
  try {
    const reservation = await $fetch<Reservation>(`/api/reservations/${targetId}/confirm`, {
      method: 'POST',
    })
    holdConfirmMessage.value = `Place confirmee (billet ${reservation.id}).`
    holdConfirmId.value = ''
    await Promise.all([refresh(), refreshTickets()])
  } catch (error: any) {
    holdConfirmMessage.value = errorMessage(error, 'Confirmation impossible.')
  }
}
</script>

<template>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">POC billetterie</span>
      <h1>Reservez votre place, sans friction</h1>
      <p class="lede">
        Confirmation en un clic au prix affiche (paiement simule). Reservez tot pour profiter du tarif early.
        Tous les horaires sont en UTC.
      </p>
    </section>

    <p v-if="events && !events.length" class="loading">Aucun concert a venir pour le moment.</p>

    <p v-if="pending" class="loading">Chargement des evenements…</p>

    <section v-for="event in events" :key="event.id" class="event-card">
      <div class="event-head">
        <div>
          <h2>{{ event.name }}</h2>
          <p class="organizer">Organise par <strong>{{ event.organizerName }}</strong></p>
        </div>
        <span class="event-date">📅 {{ formatUtc(event.eventDate) }}</span>
      </div>

      <div class="categories">
        <article v-for="category in event.categories" :key="category.id" class="category-card">
          <div class="category-head">
            <h3>{{ category.name }}</h3>
            <span class="badge" :class="availabilityTone(category)">
              {{ category.placesDisponibles }} / {{ category.totalPlaces }} places
            </span>
          </div>

          <p class="price-line">
            <strong class="price">{{ formatPrice(category.unitPriceCents) }}</strong>
            <template v-if="category.isEarly">
              <s class="muted">{{ formatPrice(category.priceCents) }}</s>
              <span class="badge early">Early jusqu'au {{ formatUtc(category.earlyUntil) }}</span>
            </template>
          </p>

          <div class="progress-track">
            <div
              class="progress-fill"
              :class="availabilityTone(category)"
              :style="{ width: availabilityRatio(category) + '%' }"
            />
          </div>

          <p v-if="category.waitlistCount" class="muted">
            ⏳ {{ category.waitlistCount }} personne(s) en liste d'attente
          </p>

          <form
            class="reserve-form"
            @submit.prevent="category.placesDisponibles > 0 ? reserve(category.id) : joinWaitlist(category.id)"
          >
            <input
              v-if="category.placesDisponibles > 0"
              v-model.number="formFor(category.id).quantity"
              type="number"
              min="1"
              :max="CONFIG.tickets.maxPerUser"
              aria-label="Quantite"
            />
            <button type="submit" class="btn" :class="category.placesDisponibles > 0 ? 'btn-primary' : 'btn-ghost'" :disabled="pendingAction[category.id]">
              {{ category.placesDisponibles > 0 ? 'Reserver' : "Rejoindre la liste d'attente" }}
            </button>
          </form>
          <p v-if="errors[category.id]" class="feedback">{{ errors[category.id] }}</p>
        </article>
      </div>
    </section>

    <section v-if="tickets && tickets.length" class="tickets">
      <h2>Mes billets</h2>
      <div class="ticket-grid">
        <article v-for="ticket in tickets" :key="ticket.id" class="ticket-card">
          <div class="ticket-top">
            <div>
              <p class="ticket-email">{{ ticket.ticketCategory.event.name }}</p>
              <p class="muted">{{ formatUtc(ticket.ticketCategory.event.eventDate) }}</p>
              <p class="muted">
                {{ ticket.ticketCategory.name }} — {{ ticket.quantity }} x {{ formatPrice(ticket.unitPriceCents) }}
                <span v-if="ticket.isEarly" class="badge early">Early</span>
              </p>
            </div>
            <span class="badge" :class="ticket.status === 'CONFIRMED' ? 'success' : 'warning'">{{ ticket.status }}</span>
          </div>

          <img
            v-if="ticket.status === 'CONFIRMED'"
            :src="`/api/reservations/${ticket.id}/qrcode`"
            alt="QR code du billet"
            width="150"
            height="150"
            class="qr"
          />

          <p v-if="ticket.status === 'CONFIRMED'" class="muted token-line">
            Token du QR (a presenter au controle) :
            <code>{{ ticket.qrToken }}</code>
          </p>
          <p v-else-if="ticket.status === 'HELD'" class="muted token-line">
            Place liberee pour vous : a confirmer avant {{ formatUtc(ticket.holdExpiresAt) }}.
          </p>

          <div v-if="ticket.status === 'CONFIRMED'" class="ticket-actions">
            <button type="button" class="btn btn-outline" @click="cancel(ticket)">Annuler</button>
            <button type="button" class="btn btn-ghost" @click="replay(ticket)">Tester anti-doublon</button>
          </div>
          <div v-else-if="ticket.status === 'HELD'" class="ticket-actions">
            <button type="button" class="btn btn-primary" @click="confirmHold(ticket.id)">Confirmer la place</button>
          </div>

          <p v-if="replayResults[ticket.id] === true" class="feedback ok">
            ✅ Idempotence OK : meme billet renvoye, aucun doublon cree.
          </p>
          <p v-else-if="replayResults[ticket.id] === false" class="feedback">
            ⚠️ Anomalie : un billet different a ete renvoye.
          </p>
        </article>
      </div>
    </section>

    <section class="waitlist-confirm">
      <h2>Confirmer une place liberee</h2>
      <p class="muted">
        Les notifications de liste d'attente sont simulees dans la console du serveur (section 2.4) : copiez-y
        l'id de reservation propose.
      </p>
      <form class="reserve-form" @submit.prevent="confirmHold()">
        <input v-model="holdConfirmId" placeholder="id de reservation HELD" required />
        <button type="submit" class="btn btn-primary">Confirmer</button>
      </form>
      <p v-if="holdConfirmMessage" class="feedback">{{ holdConfirmMessage }}</p>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 880px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 4rem;
}

.hero {
  text-align: center;
  padding: 2.5rem 1rem 3rem;
}

.eyebrow {
  display: inline-block;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
}

.hero h1 {
  font-size: clamp(2.1rem, 5.5vw, 3.6rem);
  font-weight: 800;
  line-height: 1.05;
  margin: 0 0 1rem;
  color: var(--color-text);
}

.lede {
  color: var(--color-muted);
  max-width: 46ch;
  margin: 0 auto;
}

.loading {
  text-align: center;
  color: var(--color-muted);
}

.event-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 1.75rem;
  margin-bottom: 2rem;
}

.event-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.event-head h2 {
  margin: 0;
}

.event-date {
  color: var(--color-muted);
  font-size: 0.9rem;
}

.organizer {
  margin: 0.2rem 0 0;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.price-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.6rem;
}

.price {
  font-size: 1.15rem;
}

.badge.early {
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.categories {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.category-card {
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.1rem;
}

.category-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.category-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.category-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  white-space: nowrap;
}

.badge.success {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.badge.warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.badge.danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: var(--color-surface-alt);
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease;
}

.progress-fill.success {
  background: var(--color-success);
}

.progress-fill.warning {
  background: var(--color-warning);
}

.progress-fill.danger {
  background: var(--color-danger);
}

.reserve-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.reserve-form input {
  flex: 1 1 150px;
  min-width: 0;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-input-bg);
  font-size: 0.9rem;
}

.reserve-form input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.reserve-form input[type='number'] {
  flex: 0 0 72px;
}

.btn {
  border: none;
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: transform 0.1s ease, opacity 0.15s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-outline {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger-soft);
}

.btn-ghost {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.feedback {
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: var(--color-danger);
}

.feedback.ok {
  color: var(--color-success);
}

.muted {
  color: var(--color-muted);
  font-size: 0.85rem;
}

.muted.small {
  font-size: 0.75rem;
  font-weight: 400;
}

.tickets {
  margin-top: 2.5rem;
}

.ticket-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.ticket-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.25rem;
  text-align: center;
}

.ticket-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  text-align: left;
  margin-bottom: 0.75rem;
}

.ticket-email {
  font-weight: 700;
  margin: 0;
  word-break: break-all;
}

.qr {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  padding: 0.5rem;
  background: var(--color-input-bg);
}

.token-line {
  word-break: break-all;
  margin: 0.75rem 0;
}

.token-line code {
  background: var(--color-primary-soft);
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  font-size: 0.75rem;
}

.ticket-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.waitlist-confirm {
  margin-top: 2.5rem;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.waitlist-confirm .reserve-form {
  margin-top: 1rem;
}

.waitlist-confirm input {
  flex: 1 1 220px;
}
</style>
