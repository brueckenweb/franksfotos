# 📷 FranksFotos – Fotogalerie CMS

Persönliche Fotogalerie mit vollständigem CMS-System.

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Datenbank | MariaDB + Drizzle ORM |
| Auth | NextAuth.js v5 (Credentials) |
| Upload | Eigener UploadManager → `pics.frank-sellke.de` |
| Bilder | Sharp.js (Thumbnails + Download-Wasserzeichen) |
| Lightbox | Swiper.js |
| Videos | Plyr.js |

## Features

- ✅ Vollständiges User-Management (Gruppen + individuelle Rechte)
- ✅ Hierarchische Alben (unbegrenzte Tiefe)
- ✅ Fotos & Videos mit EXIF-Daten
- ✅ Sichtbarkeits-System (Öffentlich / Gruppen / Privat)
- ✅ Wasserzeichen beim Download (Original bleibt unberührt)
- ✅ Tags & Suche
- ✅ Kommentare & Likes
- ✅ `bnummer` Feld für Verknüpfung zur Fotodatenbank

## Benutzergruppen

| Gruppe | Beschreibung |
|---|---|
| `admin` | Vollzugriff (Hauptadmin) |
| `familie` | Upload + Kommentare + Likes |
| `user` | Kommentare + Likes + Download |
| `public` | Öffentlich (kein Login nötig) |

## Setup

### 1. Umgebungsvariablen konfigurieren

Bearbeite `.env.local`:

```env
DATABASE_URL="mysql://user:password@server:3306/franksfotos"
AUTH_SECRET="dein-geheimer-schlüssel"
UPLOAD_DOMAIN="https://pics.frank-sellke.de"
UPLOAD_API_KEY="dein-api-schlüssel"
```

### 2. Datenbank-Tabellen erstellen

```bash
npm run db:push
```

### 3. Datenbank initialisieren (Gruppen, Rechte, Admin-User)

```bash
npm run db:seed
```

Standard-Admin: `fs@brueckenweb.de` / `ChangeMe123!`
⚠️ Passwort nach erstem Login unbedingt ändern!

### 4. Development-Server starten

```bash
npm run dev
```

→ http://localhost:3000

## Verfügbare Scripts

| Script | Beschreibung |
|---|---|
| `npm run dev` | Development-Server |
| `npm run build` | Production-Build |
| `npm run start` | Production-Server |
| `npm run db:push` | DB-Schema auf Server übertragen |
| `npm run db:generate` | Drizzle Migrations generieren |
| `npm run db:migrate` | Drizzle Migrations ausführen |
| `npm run db:studio` | Drizzle Studio (DB-Browser) |
| `npm run db:seed` | Initial-Daten einspielen |

## Projektstruktur

```
src/
├── app/
│   ├── page.tsx                    # Startseite (öffentliche Galerie)
│   ├── login/page.tsx              # Login-Seite
│   ├── admin/                      # Admin-Bereich (geschützt)
│   │   ├── layout.tsx
│   │   └── page.tsx                # Dashboard
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth Route
│       ├── upload/                 # Upload → pics.frank-sellke.de
│       └── download/[id]/          # Download mit Wasserzeichen
├── lib/
│   ├── db/
│   │   ├── schema.ts               # Drizzle Schema (alle Tabellen)
│   │   ├── index.ts                # DB-Verbindung
│   │   └── seed.ts                 # Initial-Daten Script
│   ├── auth/
│   │   ├── config.ts               # NextAuth Konfiguration
│   │   ├── permissions.ts          # Rechte-Definitionen
│   │   └── types.d.ts              # TypeScript-Erweiterungen
│   └── upload/
│       ├── config.ts               # Upload-Konfiguration
│       └── UploadManager.ts        # Upload-Manager
├── components/
│   ├── admin/AdminNav.tsx          # Admin-Navigation
│   └── providers/SessionProvider.tsx
├── auth.ts                         # NextAuth Instanz
└── proxy.ts                        # Next.js Middleware (Auth-Schutz)
```

## Upload-System

Fotos/Videos werden direkt zu `https://pics.frank-sellke.de` hochgeladen:

- **Fotos**: `https://pics.frank-sellke.de/fotos/`
- **Thumbnails**: `https://pics.frank-sellke.de/thumbs/`
- **Videos**: `https://pics.frank-sellke.de/videos/`
- **Avatare**: `https://pics.frank-sellke.de/avatars/`

## Wasserzeichen

- **Browser-Ansicht**: Originalbild ohne Wasserzeichen
- **Download** (`/api/download/[id]`): Sharp.js legt automatisch `© FranksFotos – frank-sellke.de` auf das Bild

## Datenbankfeld `bnummer`

Sowohl `photos` als auch `videos` haben ein `bnummer VARCHAR(50)` Feld zur Verknüpfung mit der externen Fotodatenbank.
