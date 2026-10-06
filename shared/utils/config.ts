// Configuration centrale : toutes les limites et durees de l'application.
// Fichier "shared" : auto-importe cote serveur (Nitro) ET cote client, donc
// la validation serveur et les attributs des formulaires (maxlength, min,
// max...) lisent la meme valeur. Les secrets et reglages propres a un
// deploiement (DATABASE_URL, QR_SECRET, TRUST_PROXY...) restent dans .env.

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const CONFIG = {
  // --- Comptes, sessions, mots de passe ---
  auth: {
    nameMaxLength: 80,
    passwordMinLength: 8,
    sessionTtlMs: 7 * DAY,
    // Anti brute-force par IP (connexion : echecs ; inscription : tentatives).
    rateLimit: {
      maxAttempts: 5,
      windowMs: 15 * MINUTE,
      // Au-dela de ce nombre d'IP suivies, on purge les compteurs expires.
      sweepThreshold: 1000,
    },
    // Hachage scrypt.
    password: {
      saltBytes: 16,
      keyLength: 64,
    },
  },

  // --- Concerts et categories de billets ---
  events: {
    nameMaxLength: 120,
    maxCategories: 20,
  },
  categories: {
    nameMaxLength: 80,
    maxPlaces: 100_000,
    // Ajout de places a une categorie existante.
    maxPlacesPerAdd: 10_000,
    defaultPlacesPerAdd: 10,
    // Valeurs pre-remplies dans le formulaire de creation.
    defaultTotalPlaces: 100,
    defaultPriceEuros: 20,
  },
  pricing: {
    maxPriceEuros: 100_000,
  },

  // --- Billets et liste d'attente ---
  tickets: {
    // Quota de billets confirmes par compte et par categorie
    // (surchargeable cote serveur par la variable MAX_TICKETS_PER_EMAIL).
    maxPerUser: 4,
    // Pas d'annulation a moins de N heures du concert.
    cancellationDeadlineHours: 48,
    // Fenetre d'achat exclusive accordee au suivant de la liste d'attente.
    holdWindowMs: 2 * HOUR,
  },

  // --- Controle des billets ---
  scan: {
    stationMaxLength: 40,
    // Bip sonore du scanner (Hz / secondes).
    beep: { okHz: 880, invalidHz: 220, durationSeconds: 0.2 },
  },
  qrCode: {
    widthPx: 320,
    marginModules: 1,
  },

  // --- Interface ---
  ui: {
    // En dessous de ce taux de places restantes (%), la jauge passe en orange.
    lowAvailabilityPercent: 30,
  },
} as const
