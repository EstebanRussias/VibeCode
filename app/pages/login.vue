<script setup lang="ts">
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const name = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch(mode.value === 'login' ? '/api/auth/login' : '/api/auth/register', {
      method: 'POST',
      body: { email: email.value, name: name.value, password: password.value },
    })
    const user = await fetchCurrentUser()
    await navigateTo(user ? homeFor(user.role) : '/')
  } catch (e: any) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="page">
    <section class="card">
      <span class="eyebrow">{{ mode === 'login' ? 'Connexion' : 'Creer un compte' }}</span>
      <h1>{{ mode === 'login' ? 'Content de vous revoir' : 'Rejoignez Les Nuits de la Garonne' }}</h1>
      <p class="lede">
        Vos billets sont lies a votre compte : reservez, retrouvez-les, annulez-les. Les comptes organisateur
        sont attribues par un admin.
      </p>

      <form class="form" @submit.prevent="submit">
        <label v-if="mode === 'register'">
          Nom affiche
          <input v-model="name" required :maxlength="CONFIG.auth.nameMaxLength" autocomplete="name" placeholder="Prenom Nom" />
        </label>
        <label>
          Email
          <input v-model="email" type="email" required autocomplete="email" placeholder="vous@exemple.fr" />
        </label>
        <label>
          Mot de passe
          <input
            v-model="password"
            type="password"
            required
            :minlength="CONFIG.auth.passwordMinLength"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            :placeholder="`${CONFIG.auth.passwordMinLength} caracteres minimum`"
          />
        </label>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Creer mon compte' }}
        </button>
      </form>

      <p v-if="error" class="feedback">{{ error }}</p>

      <p class="switch">
        <template v-if="mode === 'login'">
          Pas encore de compte ?
          <button type="button" class="link" @click="mode = 'register'">Creer un compte</button>
        </template>
        <template v-else>
          Deja un compte ?
          <button type="button" class="link" @click="mode = 'login'">Se connecter</button>
        </template>
      </p>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 420px;
  margin: 0 auto;
  padding: 3rem 1.25rem 4rem;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 2rem;
  text-align: center;
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

h1 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
}

.lede {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-muted);
}

.form input {
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 1rem;
}

.form input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.75rem 1.1rem;
  font-weight: 700;
  font-size: 1rem;
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

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.feedback {
  margin-top: 1rem;
  color: var(--color-danger);
  font-size: 0.9rem;
}

.switch {
  margin-top: 1.5rem;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.link {
  border: none;
  background: none;
  padding: 0;
  color: var(--color-primary);
  font-weight: 700;
  cursor: pointer;
  font-size: inherit;
}
</style>
