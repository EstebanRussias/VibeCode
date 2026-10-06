# POC billetterie — Les Nuits de la Garonne

Proof of concept local (Nuxt 4 + Nitro + Prisma/PostgreSQL) qui demontre les mecaniques de securite
demandees par le client : anti-survente par verrouillage pessimiste, idempotence anti-doublons,
QR codes signes avec scanner anti-fraude, et liste d'attente FIFO. Pas de passerelle de paiement :
la reservation est gratuite et confirmee en un clic.

## Prerequis

- Node.js 22+
- Docker (pour PostgreSQL local)

## Mise en route

```bash
npm install

# 1. Demarre PostgreSQL en local (docker-compose.yml)
npm run db:up

# 2. Cree le schema en base
npm run db:migrate

# 3. Insere un evenement de demo (categories "Fosse" 3 places / "Balcon" 5 places)
npm run db:seed

# 4. Lance l'app
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) pour reserver, [http://localhost:3000/scan](http://localhost:3000/scan)
pour le scanner de controle, [http://localhost:3000/admin](http://localhost:3000/admin) pour la gestion des concerts.

## Comptes de demo (crees par `npm run db:seed`)

| Email | Mot de passe | Role | Droits |
| --- | --- | --- | --- |
| `admin@nuits-garonne.fr` | `admin1234` | SUPERADMIN | Gere tous les concerts (meme ceux des autres admins), peut supprimer n'importe quel billet |
| `organisateur@nuits-garonne.fr` | `admin1234` | ADMIN | Cree/modifie/supprime uniquement ses propres concerts (Scene Acoustique, Hommage Rock) |
| *(a creer via `/login`)* | — | USER | S'inscrit librement, reserve ses billets, les retrouve sur `/` |

## Demontrer l'anti-survente

Avec le serveur `npm run dev` lance, dans un autre terminal :

```bash
npm run demo:concurrency -- http://localhost:3000 demo-fosse 10
```

Envoie 10 reservations concurrentes sur la categorie "Fosse" (3 places en stock) et affiche le
nombre de reussites — doit toujours etre exactement 3, jamais plus, meme sous forte concurrence.

## Ce que couvre ce POC

- **2.1 Anti-survente** : `server/api/reservations/index.post.ts` verrouille la ligne de stock
  (`SELECT ... FOR UPDATE`) dans une transaction Prisma avant de decrementer.
- **2.2 Idempotence** : cle d'idempotence unique en base ; rejouer la meme requete renvoie le
  meme billet (bouton "Rejouer la reservation" sur la page d'accueil).
- **2.3 Scanner** : QR signe HMAC (`server/utils/qrToken.ts`), verification + marquage en une
  transaction, alerte si deja scanne. Version en ligne uniquement (pas de PWA offline).
- **2.4 Liste d'attente FIFO** : inscription automatique quand une categorie est complete,
  notification (simulee en console serveur) et fenetre de confirmation de 2h a l'annulation d'un
  billet.
- **Comptes & roles** : billets lies au compte (`userId`), sessions opaques en base
  (`server/utils/session.ts`), mots de passe hashes avec `scrypt` (natif Node, pas de dependance
  a compiler). Trois roles : USER (achete ses billets), ADMIN (gere ses propres concerts,
  `ownerId` sur `Event`), SUPERADMIN (gere tous les concerts et peut supprimer n'importe quel
  billet) — voir `server/utils/session.ts` (`requireEventManager`, `requireSuperAdmin`).

## Hors perimetre (voir la proposition complète)

Multi-tenant, passerelle de paiement, scanner hors-ligne (PWA/IndexedDB), notifications
email/SMS reelles, planning de production multi-sprints.
