# Kader Airbnb — Plateforme de gestion de logements et réservations

Une application Node.js (Express + EJS) pour publier vos logements, gérer les réservations (Supabase), envoyer des emails (EmailJS) et des liens de paiement Revolut, et marquer les statuts des réservations.

## Lancer en local

1. Installer les dépendances
```
npm install
```
2. Démarrer le serveur
```
npm run dev
```
3. Ouvrir http://localhost:3000

- Page d'accueil: liste des logements, formulaire de réservation avec pop-up toast et bouton "Valider la réservation". À la validation, la réservation est créée en base (Supabase), un récap est envoyé à l'admin et au client, et un toast vert confirme l'envoi.
- Espace Admin: configurer EmailJS, voir les réservations, mettre à jour leur statut, et depuis chaque commande, coller un lien Revolut puis cliquer "Envoyer le lien de paiement" pour l'envoyer au client.

## Configuration Supabase (obligatoire)

1) Copier `.env.example` en `.env` et remplir:
```
SUPABASE_URL=... (ex: https://xxxx.supabase.co)
SUPABASE_SERVICE_ROLE=... (clé service_role, gardez-la privée)
PORT=3000
```

2) Créer les tables dans Supabase (SQL recommandé):
```sql
-- Extensions (si nécessaire pour uuid)
create extension if not exists "pgcrypto";

-- Logements
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  address text,
  pricePerNight numeric not null,
  imageUrl text,
  capacity int default 1,
  createdAt timestamptz default now()
);

-- Réservations
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  propertyId uuid references properties(id) on delete cascade,
  startDate date not null,
  endDate date not null,
  guestName text not null,
  guestEmail text not null,
  guests int default 1,
  status text not null default 'pending', -- pending | confirmed | cancelled
  total numeric not null,
  paymentLink text,
  createdAt timestamptz default now(),
  updatedAt timestamptz
);

-- Index utiles
create index if not exists idx_bookings_property on bookings(propertyId);
create index if not exists idx_bookings_status on bookings(status);
```

Remarque: l'application utilise la clé `SERVICE_ROLE` côté serveur pour écrire. Ne l'exposez pas au front.

## Configuration EmailJS (obligatoire pour les emails)

Sur la page Admin:
- Renseignez `Public Key`, `Service ID`, `Template ID (nouvelle réservation)` et `Template ID (envoi lien Revolut)`.
- Renseignez aussi `Template ID (récap client après réservation)`.
- Saisissez également `Email admin` qui recevra les notifications.
- Ces informations sont stockées dans votre navigateur (localStorage).

### Variables disponibles pour vos templates EmailJS

Template Admin (notification nouvelle réservation):
- `admin_email`, `booking_id`, `property_id`, `start_date`, `end_date`, `guest_name`, `guest_email`, `total`

Template Client (récap après réservation):
- `to_email`, `guest_name`, `booking_id`, `property_id`, `start_date`, `end_date`, `total`, `payment_instructions`

Template Client (envoi lien Revolut):
- `to_email`, `guest_name`, `booking_id`, `total`, `start_date`, `end_date`, `revolut_link`

## Données

- Les données sont stockées dans Supabase (tables `properties`, `bookings`).

## Scripts

- `npm run dev` démarre l'app sur le port 3000.

## Notes

- Cette app est un MVP. Ajoutez une authentification admin si vous l'exposez publiquement.
- La vérification de disponibilité est simple (vérifie les chevauchements de dates sur les réservations en attente et confirmées).
- N'insérez pas de clés EmailJS dans le code source. Utilisez la page Admin pour les charger dans le navigateur.
