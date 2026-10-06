<script setup lang="ts">
interface ScanResult {
  result: 'OK' | 'ALREADY_SCANNED' | 'INVALID'
  message: string
}

const qrToken = ref('')
const scannedBy = ref('Guichet 1')
const lastResult = ref<ScanResult | null>(null)
const history = ref<Array<ScanResult & { at: string; token: string }>>([])
const scanning = ref(false)

const resultIcon: Record<ScanResult['result'], string> = {
  OK: '✅',
  ALREADY_SCANNED: '⚠️',
  INVALID: '⛔',
}

function beep(frequency: number) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtx()
    const oscillator = ctx.createOscillator()
    oscillator.frequency.value = frequency
    oscillator.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.2)
  } catch {
    // audio non disponible (ex. contexte de test) — pas bloquant pour le POC
  }
}

async function scan() {
  const token = qrToken.value.trim()
  if (!token) return

  scanning.value = true
  try {
    const result = await $fetch<ScanResult>('/api/scan', {
      method: 'POST',
      body: { qrToken: token, scannedBy: scannedBy.value },
    })

    lastResult.value = result
    history.value.unshift({ ...result, at: new Date().toLocaleTimeString('fr-FR'), token })
    beep(result.result === 'OK' ? 880 : 220)
    qrToken.value = ''
  } finally {
    scanning.value = false
  }
}
</script>

<template>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">Controle d'acces</span>
      <h1>Scanner d'entree</h1>
      <p class="lede">
        Verifie la signature du QR et marque le billet scanne. Version en ligne du POC — le mode hors-ligne
        (PWA/IndexedDB) est hors perimetre.
      </p>
    </section>

    <section class="scan-card">
      <form class="scan-form" @submit.prevent="scan">
        <label>
          Poste de scan
          <input v-model="scannedBy" placeholder="Guichet 1" />
        </label>
        <label>
          Token du QR code
          <input v-model="qrToken" placeholder="coller le token ici" autofocus />
        </label>
        <button type="submit" class="btn btn-primary" :disabled="scanning">
          {{ scanning ? 'Verification…' : '🔍 Scanner' }}
        </button>
      </form>

      <Transition name="pop" mode="out-in">
        <div v-if="lastResult" :key="lastResult.message" class="result" :class="lastResult.result.toLowerCase()">
          <span class="result-icon">{{ resultIcon[lastResult.result] }}</span>
          <div>
            <strong>{{ lastResult.result }}</strong>
            <p>{{ lastResult.message }}</p>
          </div>
        </div>
      </Transition>
    </section>

    <section v-if="history.length" class="history">
      <h2>Historique de la session</h2>
      <ul>
        <li v-for="(entry, i) in history" :key="i" class="history-row" :class="entry.result.toLowerCase()">
          <span class="history-icon">{{ resultIcon[entry.result] }}</span>
          <span class="history-time">{{ entry.at }}</span>
          <span class="history-message">{{ entry.message }}</span>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 4rem;
}

.hero {
  text-align: center;
  padding: 1.5rem 1rem 2.5rem;
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

.hero h1 {
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  margin: 0 0 0.6rem;
}

.lede {
  color: var(--color-muted);
  max-width: 46ch;
  margin: 0 auto;
}

.scan-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 1.75rem;
}

.scan-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.scan-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-muted);
}

.scan-form input {
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 1rem;
}

.scan-form input:focus {
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

.result {
  margin-top: 1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1.1rem;
  border-radius: var(--radius-md);
  font-size: 1rem;
}

.result p {
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
}

.result-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.result.ok {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.result.already_scanned {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.result.invalid {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.pop-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.pop-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.history {
  margin-top: 2rem;
}

.history ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 0.85rem;
}

.history-time {
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.history-row.already_scanned {
  border-color: #fde68a;
}

.history-row.invalid {
  border-color: #fecaca;
}
</style>
