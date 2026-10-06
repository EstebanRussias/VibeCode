<script setup lang="ts">
definePageMeta({ roles: ['ORGANIZER', 'ADMIN'] })

interface CategoryDto {
  id: string
  name: string
  totalPlaces: number
  placesDisponibles: number
  priceCents: number
  earlyPriceCents: number | null
  earlyUntil: string | null
}

interface EventDto {
  id: string
  name: string
  eventDate: string
  organizer: { id: string; name: string }
  categories: CategoryDto[]
}

interface CategoryStats {
  categoryId: string
  categoryName: string
  totalPlaces: number
  priceCents: number
  earlyPriceCents: number | null
  ticketsSold: number
  earlyTicketsSold: number
  ticketsScanned: number
  revenueCents: number
}

interface EventStats {
  categories: CategoryStats[]
  totals: { ticketsSold: number; ticketsScanned: number; revenueCents: number }
}

interface CategoryForm {
  name: string
  totalPlaces: number | null
  price: number | null
  earlyPrice: number | null
  earlyUntil: string
}

const user = useAuthUser()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

const { data: events, refresh: refreshEvents } = await useFetch<EventDto[]>('/api/organizer/events')

// Recettes par categorie (vue SQL "CategoryRevenue"), une requete par concert.
const stats = ref<Record<string, EventStats>>({})
async function loadStats() {
  const list = events.value ?? []
  const entries = await Promise.all(
    list.map(async (e) => [e.id, await $fetch<EventStats>(`/api/organizer/events/${e.id}/stats`)] as const)
  )
  stats.value = Object.fromEntries(entries)
}
onMounted(loadStats)

async function refresh() {
  await refreshEvents()
  await loadStats()
}

// Admin : filtre par organisateur pour distinguer les concerts de chacun.
const organizerFilter = ref('')
const organizers = computed(() => {
  const byId = new Map((events.value ?? []).map((e) => [e.organizer.id, e.organizer.name]))
  return [...byId].map(([id, name]) => ({ id, name }))
})
const visibleEvents = computed(() =>
  (events.value ?? []).filter((e) => !organizerFilter.value || e.organizer.id === organizerFilter.value)
)

// --- Creation d'un concert avec ses categories (une seule requete) ---
function emptyCategory(): CategoryForm {
  return { name: '', totalPlaces: 100, price: 20, earlyPrice: null, earlyUntil: '' }
}

const newEvent = reactive({ name: '', eventDate: '', categories: [emptyCategory()] })
const createError = ref('')
const creating = ref(false)

function categoryPayload(c: CategoryForm) {
  return {
    name: c.name,
    totalPlaces: c.totalPlaces,
    price: c.price,
    earlyPrice: c.earlyPrice ?? undefined,
    earlyUntil: c.earlyUntil || undefined,
  }
}

async function createEvent() {
  createError.value = ''
  creating.value = true
  try {
    await $fetch('/api/organizer/events', {
      method: 'POST',
      body: {
        name: newEvent.name,
        eventDate: newEvent.eventDate,
        categories: newEvent.categories.map(categoryPayload),
      },
    })
    newEvent.name = ''
    newEvent.eventDate = ''
    newEvent.categories = [emptyCategory()]
    await refresh()
  } catch (error: any) {
    createError.value = errorMessage(error)
  } finally {
    creating.value = false
  }
}

// --- Gestion d'un concert existant ---
const openCategoryForm = reactive<Record<string, boolean>>({})
const categoryForms = reactive<Record<string, CategoryForm>>({})
const eventErrors = reactive<Record<string, string>>({})
const addPlacesAmount = reactive<Record<string, number>>({})

function categoryFormFor(eventId: string) {
  if (!categoryForms[eventId]) categoryForms[eventId] = emptyCategory()
  return categoryForms[eventId]
}

async function addCategory(eventId: string) {
  eventErrors[eventId] = ''
  try {
    await $fetch(`/api/organizer/events/${eventId}/categories`, {
      method: 'POST',
      body: categoryPayload(categoryFormFor(eventId)),
    })
    categoryForms[eventId] = emptyCategory()
    openCategoryForm[eventId] = false
    await refresh()
  } catch (error: any) {
    eventErrors[eventId] = errorMessage(error)
  }
}

async function addPlaces(eventId: string, categoryId: string) {
  eventErrors[eventId] = ''
  try {
    await $fetch(`/api/organizer/categories/${categoryId}/add-places`, {
      method: 'POST',
      body: { amount: addPlacesAmount[categoryId] || 10 },
    })
    await refresh()
  } catch (error: any) {
    eventErrors[eventId] = errorMessage(error, "Impossible d'ajouter des places.")
  }
}

async function deleteEvent(event: EventDto) {
  if (!confirm(`Supprimer definitivement "${event.name}" et tous ses billets ?`)) return
  try {
    await $fetch(`/api/organizer/events/${event.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error: any) {
    eventErrors[event.id] = errorMessage(error, 'Suppression impossible.')
  }
}

function categoryOf(event: EventDto, categoryId: string) {
  return event.categories.find((c) => c.id === categoryId)
}
</script>

<template>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">{{ isAdmin ? 'Admin' : 'Espace organisateur' }}</span>
      <h1>{{ isAdmin ? 'Tous les concerts' : 'Mes concerts' }}</h1>
      <p class="lede">
        Recettes par categorie, export de la liste des participants et gestion des places. Horaires en UTC.
      </p>
    </section>

    <section class="card">
      <h2>Creer un concert</h2>
      <form class="create-form" @submit.prevent="createEvent">
        <div class="row">
          <label class="grow">
            Nom du concert
            <input v-model="newEvent.name" required maxlength="120" placeholder="Ex. Nuit Jazz & Blues" />
          </label>
          <label>
            Date et heure (UTC)
            <input v-model="newEvent.eventDate" type="datetime-local" required />
          </label>
        </div>

        <fieldset class="categories-fieldset">
          <legend>Categories de billets (au moins une)</legend>
          <div v-for="(category, index) in newEvent.categories" :key="index" class="category-row">
            <label class="grow">
              Nom
              <input v-model="category.name" required maxlength="80" placeholder="Fosse, Balcon, VIP…" />
            </label>
            <label>
              Places
              <input v-model.number="category.totalPlaces" type="number" min="1" required />
            </label>
            <label>
              Prix (€)
              <input v-model.number="category.price" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Prix early (€)
              <input v-model.number="category.earlyPrice" type="number" min="0" step="0.01" placeholder="optionnel" />
            </label>
            <label>
              Early jusqu'au (UTC)
              <input v-model="category.earlyUntil" type="datetime-local" />
            </label>
            <button
              type="button"
              class="btn btn-icon"
              :disabled="newEvent.categories.length === 1"
              title="Retirer la categorie"
              @click="newEvent.categories.splice(index, 1)"
            >
              ✕
            </button>
          </div>
          <button type="button" class="btn btn-ghost" @click="newEvent.categories.push(emptyCategory())">
            + Ajouter une categorie
          </button>
        </fieldset>

        <button type="submit" class="btn btn-primary" :disabled="creating">
          {{ creating ? 'Creation…' : 'Creer le concert' }}
        </button>
        <p v-if="createError" class="feedback">{{ createError }}</p>
      </form>
    </section>

    <div v-if="isAdmin && organizers.length > 1" class="filter">
      <label>
        Organisateur
        <select v-model="organizerFilter">
          <option value="">Tous</option>
          <option v-for="o in organizers" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>
      </label>
    </div>

    <p v-if="!visibleEvents.length" class="loading">Aucun concert pour le moment.</p>

    <section v-for="event in visibleEvents" :key="event.id" class="card event-card">
      <div class="event-head">
        <div>
          <h2>{{ event.name }}</h2>
          <p class="muted">
            📅 {{ formatUtc(event.eventDate) }}
            <template v-if="isAdmin"> — organise par <strong>{{ event.organizer.name }}</strong></template>
          </p>
        </div>
        <div class="event-actions">
          <a class="btn btn-ghost" :href="`/api/organizer/events/${event.id}/attendees`" download>
            ⬇ Participants (CSV)
          </a>
          <button type="button" class="btn btn-outline" @click="deleteEvent(event)">Supprimer</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="stats">
          <thead>
            <tr>
              <th>Categorie</th>
              <th>Prix</th>
              <th class="num">Vendus</th>
              <th class="num">dont early</th>
              <th class="num">Scannes</th>
              <th class="num">Recette</th>
              <th>Places</th>
            </tr>
          </thead>
          <tbody v-if="stats[event.id]">
            <tr v-for="row in stats[event.id]!.categories" :key="row.categoryId">
              <td>{{ row.categoryName }}</td>
              <td>
                {{ formatPrice(row.priceCents) }}
                <span v-if="row.earlyPriceCents !== null" class="muted small">
                  (early {{ formatPrice(row.earlyPriceCents) }}
                  <template v-if="categoryOf(event, row.categoryId)?.earlyUntil">
                    → {{ formatUtc(categoryOf(event, row.categoryId)!.earlyUntil) }}
                  </template>)
                </span>
              </td>
              <td class="num">{{ row.ticketsSold }} / {{ row.totalPlaces }}</td>
              <td class="num">{{ row.earlyTicketsSold }}</td>
              <td class="num">{{ row.ticketsScanned }}</td>
              <td class="num">{{ formatPrice(row.revenueCents) || '0 €' }}</td>
              <td>
                <form class="inline-form" @submit.prevent="addPlaces(event.id, row.categoryId)">
                  <input
                    v-model.number="addPlacesAmount[row.categoryId]"
                    type="number"
                    min="1"
                    placeholder="10"
                    aria-label="Nombre de places a ajouter"
                  />
                  <button type="submit" class="btn btn-ghost btn-small">+</button>
                </form>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="stats[event.id]">
            <tr>
              <th colspan="2">Total</th>
              <th class="num">{{ stats[event.id]!.totals.ticketsSold }}</th>
              <th />
              <th class="num">{{ stats[event.id]!.totals.ticketsScanned }}</th>
              <th class="num">{{ formatPrice(stats[event.id]!.totals.revenueCents) || '0 €' }}</th>
              <th />
            </tr>
          </tfoot>
        </table>
        <p v-if="!stats[event.id]" class="muted">Chargement des recettes…</p>
      </div>

      <button
        v-if="!openCategoryForm[event.id]"
        type="button"
        class="btn btn-ghost"
        @click="openCategoryForm[event.id] = true"
      >
        + Nouvelle categorie
      </button>
      <form v-else class="category-row add-category" @submit.prevent="addCategory(event.id)">
        <label class="grow">
          Nom
          <input v-model="categoryFormFor(event.id).name" required maxlength="80" placeholder="Carre Or" />
        </label>
        <label>
          Places
          <input v-model.number="categoryFormFor(event.id).totalPlaces" type="number" min="1" required />
        </label>
        <label>
          Prix (€)
          <input v-model.number="categoryFormFor(event.id).price" type="number" min="0" step="0.01" required />
        </label>
        <label>
          Prix early (€)
          <input v-model.number="categoryFormFor(event.id).earlyPrice" type="number" min="0" step="0.01" placeholder="optionnel" />
        </label>
        <label>
          Early jusqu'au (UTC)
          <input v-model="categoryFormFor(event.id).earlyUntil" type="datetime-local" />
        </label>
        <button type="submit" class="btn btn-primary">Ajouter</button>
        <button type="button" class="btn btn-icon" title="Annuler" @click="openCategoryForm[event.id] = false">✕</button>
      </form>

      <p v-if="eventErrors[event.id]" class="feedback">{{ eventErrors[event.id] }}</p>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 4rem;
}

.hero {
  text-align: center;
  padding: 1.5rem 1rem 2rem;
}

.hero h1 {
  margin: 0 0 0.5rem;
}

.lede {
  color: var(--color-muted);
  margin: 0;
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

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
  margin-bottom: 1.75rem;
}

.card h2 {
  margin: 0 0 0.25rem;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.row,
.category-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.6rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-muted);
  flex: 0 1 140px;
  min-width: 0;
}

label.grow {
  flex: 1 1 200px;
}

input,
select {
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: white;
  font-size: 0.9rem;
  color: var(--color-text);
  min-width: 0;
}

input:focus,
select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.categories-fieldset {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: flex-start;
}

.categories-fieldset .category-row {
  width: 100%;
}

legend {
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0 0.4rem;
}

.filter {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.event-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.event-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.table-wrap {
  overflow-x: auto;
  margin-bottom: 1rem;
}

.stats {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.stats th,
.stats td {
  text-align: left;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.stats thead th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.stats tfoot th {
  border-bottom: none;
}

.stats .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.inline-form {
  display: flex;
  gap: 0.35rem;
}

.inline-form input {
  width: 70px;
  padding: 0.35rem 0.5rem;
}

.add-category {
  margin-top: 0.5rem;
}

.btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.55rem 1.1rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  align-self: flex-start;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
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

.btn-small {
  padding: 0.35rem 0.7rem;
}

.btn-icon {
  background: transparent;
  color: var(--color-muted);
  padding: 0.55rem 0.6rem;
}

.muted {
  color: var(--color-muted);
  font-size: 0.85rem;
  margin: 0;
}

.muted.small {
  font-size: 0.75rem;
}

.feedback {
  margin: 0.6rem 0 0;
  font-size: 0.85rem;
  color: var(--color-danger);
}
</style>
