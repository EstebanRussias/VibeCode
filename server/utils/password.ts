import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

// scrypt (natif Node, pas de dependance native a compiler) plutot que
// bcrypt/argon2 : plus simple a installer sur un poste Windows pour un POC.
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  const hashBuffer = Buffer.from(hash, 'hex')
  if (hashBuffer.length !== derivedKey.length) return false

  return timingSafeEqual(hashBuffer, derivedKey)
}
