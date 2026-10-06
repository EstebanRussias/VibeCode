// Toutes les dates de concert sont saisies et affichees en UTC. Une valeur
// sans fuseau (ex. "2026-10-12T20:00" d'un <input type="datetime-local">)
// est interpretee comme UTC, quel que soit le fuseau du serveur.
export function parseUtcDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim()
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  const date = new Date(hasZone ? raw : `${raw}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}
