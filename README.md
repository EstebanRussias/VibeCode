# POC billetterie — Les Nuits de la Garonne

Proof of concept local (Nuxt 4 + Nitro + Prisma/PostgreSQL) qui demontre les mecaniques de securite
demandees par le client : anti-survente par verrouillage pessimiste, idempotence anti-doublons,
QR codes signes avec scanner anti-fraude, et liste d'attente FIFO. Pas de passerelle de paiement :
la reservation est confirmee en un clic au prix affiche (tarif normal ou early).

## Prerequis

- Node.js 22+
- Docker (pour PostgreSQL local)

## Lancement en une commande (Docker)

```bash
docker compose up -d --build
```

Construit l'app, demarre PostgreSQL, applique les migrations, insere les donnees de demo puis lance
le serveur sur [http://localhost:3000](http://localhost:3000). Arret : `docker compose down`
(ajouter `-v` pour repartir d'une base vide). En dehors d'une demo locale, definir un vrai secret :
`QR_SECRET=... docker compose up -d --build`.

## Mise en route (developpement, sans conteneur pour l'app)

```bash
npm install

# 1. Demarre PostgreSQL en local (docker-compose.yml)
npm run db:up

# 2. Cree le schema en base
npm run db:migrate

# 3. Insere les comptes et concerts de demo
npm run db:seed

# 4. Lance l'app
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) : chaque role est redirige vers son espace
apres connexion.

## Roles et pages

| Role | Page | Droits |
| --- | --- | --- |
| USER (acheteur) | `/` | Seul role qui achete : catalogue, reservation, liste d'attente, ses billets et QR codes, annulation jusqu'a H-48 |
| ORGANIZER | `/organizer`, `/scan` | Cree un concert **avec** ses categories (prix + tarif early), gere uniquement ses concerts : recettes par categorie (vue SQL), export CSV des participants, ajout de places, scan des billets de ses concerts. N'achete pas |
| ADMIN | `/admin`, `/organizer`, `/scan` | Page gestionnaire : liste des comptes, modification du nom et du role (USER / ORGANIZER / ADMIN). Droits organisateur sur tous les concerts, suppression de n'importe quel billet |

L'inscription publique cree toujours un compte USER ; seul un ADMIN peut promouvoir un compte.

## Comptes de demo (crees par le seed)

Mots de passe de demonstration uniquement : a changer avant toute mise en ligne.

| Email | Mot de passe | Role |
| --- | --- | --- |
| `admin@nuits-garonne.fr` | `admin1234` | ADMIN |
| `organisateur@nuits-garonne.fr` | `admin1234` | ORGANIZER (Garonne Productions : Demonstration, Scene Acoustique, Hommage Rock) |
| `hangar@nuits-garonne.fr` | `admin1234` | ORGANIZER (Hangar Live : Electro, Jazz & Blues) |
| `client@nuits-garonne.fr` | `client1234` | USER |

## Tester l'API (Swagger)

Avec le serveur lance, ouvrir [http://localhost:3000/_swagger](http://localhost:3000/_swagger)
(ou `/_scalar`, spec brute sur `/_openapi.json`). Chaque route indique les roles autorises dans son
resume (`[ADMIN]`, `[ORGANIZER, ADMIN]`...) et sa description. Se connecter d'abord avec
`POST /api/auth/login` (un compte de demo ci-dessus) : le cookie de session est ensuite envoye
automatiquement. La documentation est declaree dans chaque handler via `defineRouteMeta`.

## Demontrer l'anti-survente

Avec le serveur lance (Docker ou `npm run dev`), dans un autre terminal :

```bash
npm run demo:concurrency -- http://localhost:3000 demo-fosse 10
```

Se connecte avec le compte `client@`, envoie 10 reservations concurrentes sur la categorie "Fosse"
(3 places en stock) et affiche le nombre de reussites — exactement 3, jamais plus. Le stock reste
consomme ensuite : `docker compose down -v` pour repartir d'une base neuve.

## Ce que couvre ce POC

- **2.1 Anti-survente** : `server/api/reservations/index.post.ts` verrouille la ligne de stock
  (`SELECT ... FOR UPDATE`) dans une transaction Prisma avant de decrementer.
- **2.2 Idempotence** : cle d'idempotence unique en base ; rejouer la meme requete renvoie le
  meme billet (bouton "Rejouer la reservation" sur la page d'accueil).
- **2.3 Scanner** : QR signe HMAC (`server/utils/qrToken.ts`), marquage par UPDATE conditionnel
  (deux scans simultanes du meme QR -> un seul OK), alerte si deja scanne. Reserve a
  l'organisateur du concert et aux admins. Version en ligne uniquement (pas de PWA offline).
- **2.4 Liste d'attente FIFO** : inscription automatique quand une categorie est complete,
  notification (simulee en console serveur) et fenetre de confirmation de 2h a l'annulation d'un
  billet.
- **Protection des routes par role** : `server/middleware/auth.ts` associe chaque prefixe d'API
  aux roles autorises et refuse toute route non declaree (deny by default) ; chaque handler
  revalide le role (`requireRole`) et la propriete du concert (`requireEventManager`). Les pages
  declarent leurs roles (`definePageMeta({ roles })`, garde `app/middleware/auth.global.ts`).
- **Comptes** : billets lies au compte (`userId`), sessions opaques en base
  (`server/utils/session.ts`), mots de passe hashes avec `scrypt`. Le role est relu en base a
  chaque requete : un changement de role par l'admin s'applique immediatement.
- **Prix & tarif early** : prix par categorie en centimes, tarif early optionnel jusqu'a une date ;
  le prix paye est fige sur chaque billet (`unitPriceCents`, `isEarly`).
- **Recettes** : vue SQL `CategoryRevenue` (migration `roles_prices_stats`) — billets vendus,
  dont early, scannes et recette par categorie ; lue par `GET /api/organizer/events/:id/stats`.
- **Export CSV** : `GET /api/organizer/events/:id/attendees` (format Excel FR, cellules protegees
  contre l'injection de formules).
- **Horaires en UTC** : saisie et affichage des dates de concert en UTC (`server/utils/dates.ts`,
  `app/utils/format.ts`).

## Hors perimetre (voir la proposition complète)

Multi-tenant, passerelle de paiement, scanner hors-ligne (PWA/IndexedDB), notifications
email/SMS reelles, planning de production multi-sprints.
