import { createHmac, timingSafeEqual } from 'node:crypto'

// QR code a usage unique (section 2.3) : le token embarque l'id de la
// reservation + une signature HMAC, pour qu'un QR ne puisse pas etre
// falsifie a partir d'une simple capture d'ecran d'un autre billet.

function getSecret() {
  const secret = process.env.QR_SECRET
  if (!secret) {
    throw new Error('QR_SECRET is not configured')
  }
  return secret
}

function sign(reservationId: string) {
  return createHmac('sha256', getSecret()).update(reservationId).digest('hex')
}

export function signReservationToken(reservationId: string) {
  return `${reservationId}.${sign(reservationId)}`
}

export function verifyReservationToken(token: string): { valid: boolean; reservationId?: string } {
  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex <= 0) return { valid: false }

  const reservationId = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  const expected = sign(reservationId)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return { valid: false }

  const valid = timingSafeEqual(signatureBuffer, expectedBuffer)
  return valid ? { valid: true, reservationId } : { valid: false }
}
