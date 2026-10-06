<script setup lang="ts">
interface TicketCategory {
  id: string
  name: string
  totalPlaces: number
  placesDisponibles: number
  waitlistCount: number
}

interface EventDto {
  id: string
  name: string
  eventDate: string
  ownerId: string
  ownerEmail: string
  categories: TicketCategory[]
}

const user = useAuthUser()
if (user.value === undefined) await fetchCurrentUser()

const { data: events, refresh } = await useFetch<EventDto[]>('/api/events')

function canManage(event: EventDto) {
  return user.value?.role === 'SUPERADMIN' || event.ownerId === user.value?.id
}

const newEvent = reactive({ name: '', eventDate: '' })
const newEventError = ref('')
const newEventPending = ref(false)

async function createEvent() {
  newEventError.value = ''
  newEventPending.value = true
  try {
    await $fetch('/api/admin/events', {
      method: 'POST',
      body: { name: newEvent.name, eventDate: newEvent.eventDate },
    })
    newEvent.name = ''
    newEvent.eventDate = ''
    await refresh()
  } catch (error: any) {
    newEventError.value = error?.data?.statusMessage || error?.statusMessage || 'Erreur inconnue.'
  } finally {
    newEventPending.value = false
  }
}

const categoryForms = reactive<Record<string, { name: string; totalPlaces: number }>>({})
const categoryErrors = reactive<Record<string, string>>({})

function categoryFormFor(eventId: string) {
  if (!categoryForms[eventId]) categoryForms[eventId] = { name: '', totalPlaces: 20 }
  return categoryForms[eventId]
}

async function addCategory(eventId: string) {
  categoryErrors[eventId] = ''
  const form = categoryFormFor(eventId)
  try {
    await $fetch(`/api/admin/events/${eventId}/categories`, {
      method: 'POST',
      body: { name: form.name, totalPlaces: form.totalPlaces },
    })
    form.name = ''
    await refresh()
  } catch (error: any) {
    categoryErrors[eventId] = error?.data?.statusMessage || error?.statusMessage || 'Erreur inconnue.'
  }
}

const addPlacesAmount = reactive<Record<string, number>>({})

async function addPlaces(categoryId: string) {
  const amount = addPlacesAmount[categoryId] || 10
  try {
    await $fetch(`/api/admin/categories/${categoryId}/add-places`, {
      method: 'POST',
      body: { amount },
    })
    await refresh()
  } catch (error: any) {
    alert(error?.data?.statusMessage || error?.statusMessage || "Impossible d'ajouter des places.")
  }
}

async function deleteEvent(event: EventDto) {
  if (!confirm(`Supprimer definitivement "${event.name}" et tous ses billets ?`)) return
  try {
    await $fetch(`/api/admin/events/${event.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error: any) {
    alert(error?.data?.statusMessage || error?.statusMessage || 'Suppression impossible.')
  }
}

const deleteReservationId = ref('')
const deleteReservationMessage = ref('')

async function deleteReservation() {
  deleteReservationMessage.value = ''
  try {
    await $fetch(`/api/admin/reservations/${deleteReservationId.value}`, { method: 'DELETE' })
    deleteReservationMessage.value = 'Billet supprime et place remise en stock.'
    deleteReservationId.value = ''
    await refresh()
  } catch (error: any) {
    deleteReservationMessage.value = error?.data?.statusMessage || error?.statusMessage || 'Suppression impossible.'
  }
}
</script>

<template>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">Espace organisateur</span>
      <h1>Gestion des concerts</h1>
    </section>

    <p v-if="user === undefined" class="loading">Chargement…</p>

    <section v-else-if="!user" class="notice">
      <p>Connectez-vous pour acceder a l'espace organisateur.</p>
      <NuxtLink to="/login" class="btn btn-primary">Se connecter</NuxtLink>
    </section>

    <section v-else-if="user.role === 'USER'" class="notice">
      <p>Acces reserve aux organisateurs (ADMIN / SUPERADMIN).</p>
    </section>

    <template v-else>
      <p class="role-hint">
        Connecte en tant que <strong>{{ user.email }}</strong> —
        <span v-if="user.role === 'SUPERADMIN'">super-admin : acces a tous les concerts.</span>
        <span v-else>admin : acces limite a vos propres concerts.</span>
      </p>

      <section class="create-card">
        <h2>Creer un concert</h2>
        <form class="inline-form" @submit.prevent="createEvent">
          <input v-model="newEvent.name" placeholder="Nom du concert" required />
          <input v-model="newEvent.eventDate" type="datetime-local" required />
          <button type="submit" class="btn btn-primary" :disabled="newEventPending">Creer</button>
        </form>
        <p v-if="newEventError" class="feedback">{{ newEventError }}</p>
      </section>

      <section v-for="event in events" :key="event.id" class="event-card">
        <div class="event-head">
          <div>
            <h2>{{ event.name }}</h2>
            <p class="muted">
              {{ new Date(event.eventDate).toLocaleString('fr-FR') }} — proprietaire : {{ event.ownerEmail }}
            </p>
          </div>
          <button v-if="canManage(event)" type="button" class="btn btn-outline" @click="deleteEvent(event)">
            Supprimer le concert
          </button>
        </div>

        <div class="categories">
          <article v-for="category in event.categories" :key="category.id" class="category-card">
            <div class="category-head">
              <h3>{{ category.name }}</h3>
              <span class="badge">{{ category.placesDisponibles }} / {{ category.totalPlaces }}</span>
            </div>
            <form v-if="canManage(event)" class="inline-form" @submit.prevent="addPlaces(category.id)">
              <input
                v-model.number="addPlacesAmount[category.id]"
                type="number"
                min="1"
                placeholder="10"
                aria-label="Nombre de places a ajouter"
              />
              <button type="submit" class="btn btn-ghost">+ Places</button>
            </form>
          </article>
        </div>

        <form v-if="canManage(event)" class="inline-form category-add" @submit.prevent="addCategory(event.id)">
          <input v-model="categoryFormFor(event.id).name" placeholder="Nouvelle categorie (ex: Carre Or)" required />
          <input v-model.number="categoryFormFor(event.id).totalPlaces" type="number" min="1" placeholder="Places" />
          <button type="submit" class="btn btn-ghost">Ajouter la categorie</button>
        </form>
        <p v-if="categoryErrors[event.id]" class="feedback">{{ categoryErrors[event.id] }}</p>
      </section>

      <section v-if="user.role === 'SUPERADMIN'" class="danger-card">
        <h2>Supprimer un billet (super-admin)</h2>
        <p class="muted">
          Supprime definitivement un billet, quel qu'en soit le proprietaire, et remet la place en stock.
        </p>
        <form class="inline-form" @submit.prevent="deleteReservation">
          <input v-model="deleteReservationId" placeholder="id du billet" required />
          <button type="submit" class="btn btn-outline">Supprimer</button>
        </form>
        <p v-if="deleteReservationMessage" class="feedback">{{ deleteReservationMessage }}</p>
      </section>
    </template>
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
  padding: 1.5rem 1rem 2rem;
}

.eyebrow {
  display: inline-block;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.loading {
  text-align: center;
  color: var(--color-muted);
}

.notice {
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 2rem;
}

.notice .btn {
  margin-top: 1rem;
  display: inline-block;
  text-decoration: none;
}

.role-hint {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.create-card,
.danger-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.danger-card {
  border-color: var(--color-danger-soft);
}

.event-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.event-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.event-head h2 {
  margin: 0 0 0.25rem;
}

.categories {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin-bottom: 1rem;
}

.category-card {
  background: #fbfaff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
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
  font-size: 1rem;
}

.badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
  white-space: nowrap;
}

.inline-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.inline-form input {
  flex: 1 1 140px;
  min-width: 0;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: white;
  font-size: 0.9rem;
}

.inline-form input[type='number'] {
  flex: 0 0 90px;
}

.category-add {
  margin-top: 0.5rem;
}

.btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.55rem 1.1rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-outline {
  background: white;
  color: var(--color-danger);
  border: 1px solid var(--color-danger-soft);
}

.btn-ghost {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.muted {
  color: var(--color-muted);
  font-size: 0.85rem;
}

.feedback {
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: var(--color-danger);
}
</style>
