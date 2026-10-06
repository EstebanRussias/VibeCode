export interface CategoryInput {
  name?: unknown
  totalPlaces?: unknown
  price?: unknown
  earlyPrice?: unknown
  earlyUntil?: unknown
}

const MAX_PLACES = 100_000

// Validation commune creation de concert / ajout de categorie.
export function parseCategoryInput(input: CategoryInput | undefined, eventDate: Date) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const totalPlaces = Number(input?.totalPlaces)

  if (!name || name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Nom de categorie requis (80 caracteres max).' })
  }
  if (!Number.isInteger(totalPlaces) || totalPlaces < 1 || totalPlaces > MAX_PLACES) {
    throw createError({ statusCode: 400, statusMessage: `Categorie "${name}" : places entre 1 et ${MAX_PLACES}.` })
  }

  return { name, totalPlaces, placesDisponibles: totalPlaces, ...parsePriceFields(input ?? {}, eventDate) }
}
