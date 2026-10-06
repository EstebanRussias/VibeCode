// Horaires de concert toujours affiches en UTC (meme reference pour tous,
// quel que soit le fuseau du navigateur).
export function formatUtc(value: string | Date | null | undefined) {
  if (!value) return ''
  const text = new Date(value).toLocaleString('fr-FR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${text} UTC`
}

export function formatPrice(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return ''
  if (cents === 0) return 'Gratuit'
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function errorMessage(error: any, fallback = 'Erreur inconnue.') {
  return error?.data?.statusMessage || error?.statusMessage || fallback
}
