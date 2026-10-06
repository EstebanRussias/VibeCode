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
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding: 1.25rem 2rem;
  background: rgba(10, 10, 10, 0.78);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: var(--color-text);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--color-primary);
  font-size: 1.15rem;
  line-height: 1;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.brand-text strong {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.brand-text small {
  color: var(--color-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.nav {
  grid-column: 2;
  display: flex;
  justify-content: center;
  gap: 1.75rem;
}

.nav-link {
  position: relative;
  padding: 0.35rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--color-muted);
  transition: color 0.15s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -0.2rem;
  height: 2px;
  border-radius: 2px;
  background: var(--color-primary);
  transform: scaleX(0);
  transition: transform 0.2s ease;
}

.nav-link:hover {
  color: var(--color-text);
}

.nav-link.active {
  color: var(--color-text);
}

.nav-link.active::after,
.nav-link:hover::after {
  transform: scaleX(1);
}

.account {
  grid-column: 3;
  justify-self: end;
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
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 0.25rem 0.65rem;
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
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  padding: 0.55rem 1.25rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.account-btn:hover {
  border-color: var(--color-text);
  background: var(--color-surface-alt);
}

.account-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

.account-btn.primary:hover {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.content {
  flex: 1;
}

.footer {
  text-align: center;
  padding: 2rem 1rem 2.5rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  font-size: 0.8rem;
}

@media (max-width: 860px) {
  .topbar {
    grid-template-columns: 1fr auto;
  }

  .nav {
    grid-column: 1 / -1;
    grid-row: 2;
    gap: 1.25rem;
  }

  .account {
    grid-column: 2;
    grid-row: 1;
  }
}

@media (max-width: 520px) {
  .topbar {
    padding: 1rem;
  }

  .brand-text small {
    display: none;
  }
}
</style>
