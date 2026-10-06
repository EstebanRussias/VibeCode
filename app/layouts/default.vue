<script setup lang="ts">
const route = useRoute()
const user = useAuthUser()

if (user.value === undefined) {
  await fetchCurrentUser()
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  await navigateTo('/')
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <NuxtLink to="/" class="brand">
        <span class="brand-mark">🎫</span>
        <span class="brand-text">
          <strong>Les Nuits de la Garonne</strong>
          <small>POC billetterie</small>
        </span>
      </NuxtLink>

      <nav class="nav">
        <NuxtLink to="/" class="nav-link" :class="{ active: route.path === '/' }">Réservation</NuxtLink>
        <NuxtLink to="/scan" class="nav-link" :class="{ active: route.path === '/scan' }">Scanner</NuxtLink>
        <NuxtLink v-if="user?.role === 'ADMIN'" to="/admin" class="nav-link" :class="{ active: route.path === '/admin' }">
          Admin
        </NuxtLink>
      </nav>

      <div class="account">
        <template v-if="user">
          <span class="account-email">{{ user.email }}</span>
          <button type="button" class="account-btn" @click="logout">Deconnexion</button>
        </template>
        <NuxtLink v-else to="/login" class="account-btn primary">Se connecter</NuxtLink>
      </div>
    </header>

    <div class="content">
      <slot />
    </div>

    <footer class="footer">
      <span>POC local — sans passerelle de paiement, reservation confirmee en un clic.</span>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-decoration: none;
  color: var(--color-text);
}

.brand-mark {
  font-size: 1.6rem;
  line-height: 1;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.brand-text strong {
  font-size: 1rem;
}

.brand-text small {
  color: var(--color-muted);
  font-size: 0.75rem;
}

.nav {
  display: flex;
  gap: 0.4rem;
  background: var(--color-primary-soft);
  padding: 0.3rem;
  border-radius: 999px;
}

.nav-link {
  padding: 0.45rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--color-primary-dark);
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-link:hover {
  background: rgba(124, 58, 237, 0.12);
}

.nav-link.active {
  background: var(--color-primary);
  color: white;
}

.account {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.account-email {
  font-size: 0.85rem;
  color: var(--color-muted);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-btn {
  border: none;
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
  padding: 0.45rem 1rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}

.account-btn:hover {
  background: rgba(124, 58, 237, 0.18);
}

.account-btn.primary {
  background: var(--color-primary);
  color: white;
}

.account-btn.primary:hover {
  background: var(--color-primary-dark);
}

.content {
  flex: 1;
}

.footer {
  text-align: center;
  padding: 1.5rem 1rem 2rem;
  color: var(--color-muted);
  font-size: 0.8rem;
}

@media (max-width: 520px) {
  .brand-text small {
    display: none;
  }
}
</style>
