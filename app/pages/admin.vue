<script setup lang="ts">
definePageMeta({ roles: ['ADMIN'] })

interface UserRow {
  id: string
  email: string
  name: string
  role: Role
  createdAt: string
  _count: { ownedEvents: number; reservations: number }
}

const currentUser = useAuthUser()
const { data: users, refresh } = await useFetch<UserRow[]>('/api/admin/users')

const roleOptions: Role[] = ['USER', 'ORGANIZER', 'ADMIN']

// Brouillon par ligne : on n'envoie que ce qui a change.
const drafts = reactive<Record<string, { name: string; role: Role }>>({})
const rowMessages = reactive<Record<string, { ok: boolean; text: string }>>({})
const saving = reactive<Record<string, boolean>>({})

watchEffect(() => {
  for (const u of users.value ?? []) {
    if (!drafts[u.id]) drafts[u.id] = { name: u.name, role: u.role }
  }
})

function isDirty(u: UserRow) {
  const draft = drafts[u.id]
  return !!draft && (draft.name.trim() !== u.name || draft.role !== u.role)
}

async function save(u: UserRow) {
  const draft = drafts[u.id]!
  saving[u.id] = true
  delete rowMessages[u.id]
  try {
    const body: { name?: string; role?: Role } = {}
    if (draft.name.trim() !== u.name) body.name = draft.name
    if (draft.role !== u.role) body.role = draft.role
    await $fetch(`/api/admin/users/${u.id}`, { method: 'POST', body })
    await refresh()
    drafts[u.id] = { name: draft.name.trim(), role: draft.role }
    rowMessages[u.id] = { ok: true, text: 'Enregistre.' }
    if (u.id === currentUser.value?.id) await fetchCurrentUser()
  } catch (error: any) {
    rowMessages[u.id] = { ok: false, text: errorMessage(error) }
  } finally {
    saving[u.id] = false
  }
}

function reset(u: UserRow) {
  drafts[u.id] = { name: u.name, role: u.role }
  delete rowMessages[u.id]
}

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (users.value ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))
})

const deleteReservationId = ref('')
const deleteReservationMessage = ref('')

async function deleteReservation() {
  deleteReservationMessage.value = ''
  try {
    await $fetch(`/api/admin/reservations/${deleteReservationId.value.trim()}`, { method: 'DELETE' })
    deleteReservationMessage.value = 'Billet supprime et place remise en stock.'
    deleteReservationId.value = ''
  } catch (error: any) {
    deleteReservationMessage.value = errorMessage(error, 'Suppression impossible.')
  }
}
</script>

<template>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">Admin</span>
      <h1>Gestion des utilisateurs</h1>
      <p class="lede">
        Modifiez le nom et le role de chaque compte. Le changement s'applique immediatement, y compris aux sessions
        deja ouvertes.
      </p>
    </section>

    <section class="card">
      <div class="toolbar">
        <h2>{{ users?.length ?? 0 }} comptes</h2>
        <input v-model="search" type="search" placeholder="Rechercher un nom ou un email" />
      </div>

      <div class="table-wrap">
        <table class="users">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Role</th>
              <th class="num">Concerts</th>
              <th class="num">Billets</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filtered" :key="u.id" :class="{ dirty: isDirty(u) }">
              <td>
                <input v-if="drafts[u.id]" v-model="drafts[u.id]!.name" :maxlength="CONFIG.auth.nameMaxLength" aria-label="Nom" />
              </td>
              <td class="email">
                {{ u.email }}
                <span v-if="u.id === currentUser?.id" class="you">vous</span>
              </td>
              <td>
                <select
                  v-if="drafts[u.id]"
                  v-model="drafts[u.id]!.role"
                  :disabled="u.id === currentUser?.id"
                  aria-label="Role"
                >
                  <option v-for="r in roleOptions" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
                </select>
              </td>
              <td class="num">{{ u._count.ownedEvents }}</td>
              <td class="num">{{ u._count.reservations }}</td>
              <td class="actions">
                <template v-if="isDirty(u)">
                  <button type="button" class="btn btn-primary" :disabled="saving[u.id]" @click="save(u)">
                    Enregistrer
                  </button>
                  <button type="button" class="btn btn-icon" title="Annuler" @click="reset(u)">✕</button>
                </template>
                <span v-if="rowMessages[u.id]" class="row-message" :class="{ ok: rowMessages[u.id]!.ok }">
                  {{ rowMessages[u.id]!.text }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card danger-card">
      <h2>Supprimer un billet</h2>
      <p class="muted">
        Supprime definitivement un billet, quel qu'en soit le titulaire, et remet la place en stock (liste d'attente
        servie en priorite).
      </p>
      <form class="inline-form" @submit.prevent="deleteReservation">
        <input v-model="deleteReservationId" placeholder="id du billet (colonne Billet de l'export CSV)" required />
        <button type="submit" class="btn btn-outline">Supprimer</button>
      </form>
      <p v-if="deleteReservationMessage" class="feedback">{{ deleteReservationMessage }}</p>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 1000px;
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
  max-width: 60ch;
  margin: 0 auto;
}

.eyebrow {
  display: inline-block;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 1rem;
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
  margin: 0;
}

.danger-card {
  border-color: var(--color-danger-soft);
}

.danger-card h2 {
  margin-bottom: 0.4rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

input,
select {
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-input-bg);
  font-size: 0.88rem;
  color: var(--color-text);
  min-width: 0;
}

input:focus,
select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.table-wrap {
  overflow-x: auto;
}

.users {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.users th,
.users td {
  text-align: left;
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.users thead th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.users tr.dirty td {
  background: var(--color-surface-alt);
}

.users td input {
  width: 100%;
  min-width: 140px;
}

.users .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.email {
  color: var(--color-muted);
}

.you {
  margin-left: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.6rem;
}

.row-message {
  font-size: 0.8rem;
  color: var(--color-danger);
  white-space: normal;
}

.row-message.ok {
  color: var(--color-success);
}

.inline-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.inline-form input {
  flex: 1 1 260px;
}

.btn {
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-outline {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger-soft);
}

.btn-icon {
  background: transparent;
  color: var(--color-muted);
  padding: 0.5rem 0.55rem;
}

.muted {
  color: var(--color-muted);
  font-size: 0.85rem;
  margin: 0;
}

.feedback {
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: var(--color-danger);
}
</style>
