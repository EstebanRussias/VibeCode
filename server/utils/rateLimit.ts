import type { H3Event } from 'h3'

// Limiteur anti brute-force par IP, en memoire (POC mono-instance : le
// compteur est perdu au redemarrage et non partage entre plusieurs
// instances — passer sur Redis/Postgres pour du multi-instance).
const { maxAttempts, windowMs, sweepThreshold } = CONFIG.auth.rateLimit

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Derriere un reverse proxy, X-Forwarded-For est forge par le client si le
// proxy ne le reecrit pas : on ne lui fait confiance que sur demande.
export function clientIp(event: H3Event) {
  return getRequestIP(event, { xForwardedFor: process.env.TRUST_PROXY === 'true' }) ?? 'unknown'
}

function bucketFor(key: string): Bucket | undefined {
  const bucket = buckets.get(key)
  if (bucket && bucket.resetAt <= Date.now()) {
    buckets.delete(key)
    return undefined
  }
  return bucket
}

function sweepExpired() {
  if (buckets.size < sweepThreshold) return
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

function keyFor(event: H3Event, scope: string) {
  return `${scope}:${clientIp(event)}`
}

// Leve une 429 si l'IP a deja atteint le quota pour ce scope.
export function assertNotRateLimited(event: H3Event, scope: string) {
  const bucket = bucketFor(keyFor(event, scope))
  if (!bucket || bucket.count < maxAttempts) return

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))
  setResponseHeader(event, 'Retry-After', retryAfter)
  throw createError({
    statusCode: 429,
    statusMessage: `Trop de tentatives. Reessayez dans ${Math.ceil(retryAfter / 60)} minute(s).`,
  })
}

// Comptabilise une tentative (la fenetre demarre a la premiere).
export function recordAttempt(event: H3Event, scope: string) {
  sweepExpired()
  const key = keyFor(event, scope)
  const bucket = bucketFor(key)
  if (bucket) {
    bucket.count++
  } else {
    buckets.set(key, { count: 1, resetAt: Date.now() + windowMs })
  }
}

export function resetAttempts(event: H3Event, scope: string) {
  buckets.delete(keyFor(event, scope))
}
