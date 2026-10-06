export interface CategoryInput {
  name?: unknown
  totalPlaces?: unknown
  price?: unknown
  earlyPrice?: unknown
  earlyUntil?: unknown
}

// Validation commune creation de concert / ajout de categorie.
export function parseCategoryInput(input: CategoryInput | undefined, eventDate: Date) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const totalPlaces = Number(input?.totalPlaces)

  if (!name || name.length > CONFIG.categories.nameMaxLength) {
    throw createError({ statusCode: 400, statusMessage: `Nom de categorie requis (${CONFIG.categories.nameMaxLength} caracteres max).` })
  }
  if (!Number.isInteger(totalPlaces) || totalPlaces < 1 || totalPlaces > CONFIG.categories.maxPlaces) {
    throw createError({ statusCode: 400, statusMessage: `Categorie "${name}" : places entre 1 et ${CONFIG.categories.maxPlaces}.` })
  }

  return { name, totalPlaces, placesDisponibles: totalPlaces, ...parsePriceFields(input ?? {}, eventDate) }
}
