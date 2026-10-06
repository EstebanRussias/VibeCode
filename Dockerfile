# POC billetterie — image unique : build Nuxt + migrations/seed Prisma au demarrage.
FROM node:22-slim

# openssl : requis par le schema engine Prisma (migrate deploy).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# On garde les devDependencies : tsx est necessaire pour `prisma db seed`.
RUN npm ci \
  && npx prisma generate \
  && npm run build

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  PRISMA_HIDE_UPDATE_MESSAGE=1

EXPOSE 3000

# Schema a jour + donnees de demo (seed idempotent, upserts) puis serveur Nitro.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node .output/server/index.mjs"]
