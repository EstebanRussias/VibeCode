<script setup lang="ts">
const route = useRoute()
const user = useAuthUser()

// Navigation propre a chaque role (le middleware auth.global.ts redirige
// de toute facon une page non autorisee).
const links = computed(() => {
  switch (user.value?.role) {
    case 'USER':
      return [{ to: '/', label: 'Concerts & billets' }]
    case 'ORGANIZER':
      return [
        { to: '/organizer', label: 'Mes concerts' },
        { to: '/scan', label: 'Scanner' },
      ]
    case 'ADMIN':
      return [
        { to: '/admin', label: 'Utilisateurs' },
        { to: '/organizer', label: 'Concerts' },
        { to: '/scan', label: 'Scanner' },
      ]
    default:
      return []
  }
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  await navigateTo('/login')
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

      <nav v-if="links.length" class="nav">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :class="{ active: route.path === link.to }"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="account">
        <template v-if="user">
          <span class="account-email" :title="user.email">{{ user.name }}</span>
          <span class="role-badge" :class="user.role.toLowerCase()">{{ ROLE_LABELS[user.role] }}</span>
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

.role-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--color-success-soft);
  color: var(--color-success);
}

.role-badge.organizer {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.role-badge.admin {
  background: var(--color-danger-soft);
  color: var(--color-danger);
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
