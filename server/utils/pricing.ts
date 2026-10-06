interface PricedCategory {
  priceCents: number
  earlyPriceCents: number | null
  earlyUntil: Date | null
}

// Tarif applicable a l'instant `now` : early tant que earlyUntil n'est pas
// passe, sinon prix normal.
export function currentPrice(category: PricedCategory, now = new Date()) {
  const isEarly =
    category.earlyPriceCents !== null && category.earlyUntil !== null && now < category.earlyUntil
  return { unitPriceCents: isEarly ? category.earlyPriceCents! : category.priceCents, isEarly }
}

// Valide les champs de prix saisis en euros (ex. 25.5) et les convertit en
// centimes entiers.
export function parsePriceFields(
  input: { price?: unknown; earlyPrice?: unknown; earlyUntil?: unknown },
  eventDate: Date
) {
  const priceCents = eurosToCents(input.price)
  if (priceCents === null) {
    throw createError({ statusCode: 400, statusMessage: 'Prix invalide (nombre >= 0 attendu).' })
  }

  const hasEarlyPrice = input.earlyPrice !== undefined && input.earlyPrice !== null && input.earlyPrice !== ''
  const hasEarlyUntil = input.earlyUntil !== undefined && input.earlyUntil !== null && input.earlyUntil !== ''
  if (!hasEarlyPrice && !hasEarlyUntil) {
    return { priceCents, earlyPriceCents: null, earlyUntil: null }
  }
  if (!hasEarlyPrice || !hasEarlyUntil) {
    throw createError({ statusCode: 400, statusMessage: 'Tarif early : prix ET date limite requis.' })
  }

  const earlyPriceCents = eurosToCents(input.earlyPrice)
  if (earlyPriceCents === null || earlyPriceCents >= priceCents) {
    throw createError({ statusCode: 400, statusMessage: 'Le prix early doit etre inferieur au prix normal.' })
  }
  const earlyUntil = parseUtcDate(input.earlyUntil)
  if (!earlyUntil || earlyUntil > eventDate) {
    throw createError({ statusCode: 400, statusMessage: 'La fin du tarif early doit preceder le concert.' })
  }

  return { priceCents, earlyPriceCents, earlyUntil }
}

function eurosToCents(value: unknown) {
  const euros = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  if (value === '' || value === null || value === undefined || !Number.isFinite(euros) || euros < 0 || euros > 100_000) {
    return null
  }
  return Math.round(euros * 100)
}
