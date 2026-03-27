# FranksFotos – ToDo-Liste

> Zuletzt aktualisiert: 24.03.2026
> Stand: Prioritäten 1–4 abgeschlossen. Build läuft fehlerfrei (39 Routen). Alle Admin-Verbesserungen umgesetzt.

---

## 🟢 Priorität 5: Testen & Deployment

- [x] **Datenbank-Migration** – SQL-Script `franksfotos-setup.sql` erstellt → in phpMyAdmin ausgeführt ✅
- [x] **Seed-Daten** – Admin-User + Gruppen + Rechte in DB vorhanden ✅
- [x] **Upload-Script** – `server-upload/upload.php` + `.htaccess` + `.user.ini` erstellt
- [ ] **Upload-Script hochladen** – `server-upload/` Dateien auf Webroot von `pics.frank-sellke.de` hochladen (FTP/cPanel)
- [ ] **Wasserzeichen-Download** testen (`/api/download/[id]` mit Sharp.js)
- [ ] **E2E-Test**: Login → Upload → Album erstellen → Foto zuweisen → Öffentliche Ansicht

---

## 🔵 Priorität 6: Nice-to-Have

- [ ] **Lightbox-Komponente** (z.B. `yet-another-react-lightbox` oder eigene Implementation)
- [ ] **Pagination** auf Foto-Grid (aktuell limit 50 hardcodiert)
- [ ] **Breadcrumb-Navigation** auf öffentlichen Seiten
- [ ] **`/api/bridge`-Integration** – `bnummer`-Feld mit BrückenWeb verknüpfen (externe Links)
- [ ] **Mobile-Optimierung** der Admin-Oberfläche

---

## 📌 Bereits erledigt (Referenz)

### Priorität 4: Admin-Verbesserungen (✅ erledigt am 24.03.2026)
- [x] **Upload-Seite** – Fortschrittsbalken mit XHR-Progress (0–90% Transfer, 95% DB-Write, 100% fertig)
- [x] **Foto-Bearbeitung** – Tag-Auswahl per farbigen Toggle-Buttons (Laden von `/api/tags`)
- [x] **Album-Bearbeitung** – Cover-Foto auswählen (scrollbares Grid mit Thumbnails)
- [x] **Benutzer-Verwaltung** – Avatar-Upload integriert (Upload nach `/api/upload?target=avatars`)
- [x] **Gruppen-Seite** – `GroupPermissionsEditor` Client-Komponente + `PUT /api/groups/[id]/permissions`

### Priorität 1: Build-Fehler (✅ erledigt am 24.03.2026)
- [x] `npm run build` – läuft fehlerfrei durch
- [x] Unused imports entfernt:
  - [x] `src/app/admin/fotos/page.tsx` → `Image`, `Globe`, `count` entfernt
  - [x] `src/app/admin/alben/page.tsx` → `sql` entfernt
  - [x] `src/app/admin/benutzer/page.tsx` → `Users`, `Shield` entfernt
  - [x] `src/app/admin/kommentare/page.tsx` → `CheckCircle2`, `XCircle`, `Trash2`, `photos`, `videos` entfernt
  - [x] `src/app/admin/einstellungen/page.tsx` → `Settings` entfernt

### Priorität 2: Öffentliche Frontend-Seiten (✅ erledigt am 24.03.2026)
- [x] `src/app/alben/page.tsx` – Alben-Übersichtsseite (Grid mit Cover, Foto-Anzahl, Sichtbarkeitsfilter)
- [x] `src/app/alben/[slug]/page.tsx` – Foto-Links auf `/foto/[id]` aktualisiert
- [x] `src/app/foto/[id]/page.tsx` – Einzelfoto-Seite (große Ansicht, Kommentare, Likes, Download)
- [x] `src/app/foto/[id]/LikeButton.tsx` – Client-Komponente (POST/DELETE `/api/likes`)
- [x] `src/app/foto/[id]/CommentForm.tsx` – Client-Komponente (POST `/api/comments`)

### Priorität 3: API-Routen (✅ erledigt am 24.03.2026)
- [x] `src/app/api/likes/route.ts` – POST/DELETE für Foto- und Video-Likes
- [x] `src/app/api/albums/[id]/photos/route.ts` – GET Fotos eines Albums (mit Pagination)
- [x] `src/app/api/search/route.ts` – GET Suche nach Fotos/Alben/Tags

### API-Routen (✅ früher fertig)
- [x] `src/app/api/albums/route.ts` – GET alle Alben, POST Album erstellen
- [x] `src/app/api/albums/[id]/route.ts` – GET, PUT, DELETE einzelnes Album
- [x] `src/app/api/photos/route.ts` – GET Fotos (mit AlbumId-Filter, Pagination), POST
- [x] `src/app/api/photos/[id]/route.ts` – GET, PUT, DELETE einzelnes Foto
- [x] `src/app/api/videos/route.ts` – GET Videos, POST Video erstellen
- [x] `src/app/api/videos/[id]/route.ts` – PUT, DELETE einzelnes Video
- [x] `src/app/api/users/route.ts` – GET alle Benutzer (mit Gruppen), POST Benutzer erstellen
- [x] `src/app/api/users/[id]/route.ts` – GET, PUT (mit Gruppen-Neuzuweisung), DELETE
- [x] `src/app/api/tags/route.ts` – GET, POST, DELETE Tags
- [x] `src/app/api/comments/route.ts` – GET, POST, PATCH (freischalten), DELETE

### Admin-Seiten (✅ früher fertig)
- [x] `src/app/admin/alben/page.tsx` – Album-Liste
- [x] `src/app/admin/alben/neu/page.tsx` – Album erstellen
- [x] `src/app/admin/alben/[id]/edit/page.tsx` – Album bearbeiten
- [x] `src/app/admin/upload/page.tsx` – Drag & Drop Upload
- [x] `src/app/admin/fotos/page.tsx` – Foto-Grid
- [x] `src/app/admin/fotos/[id]/edit/page.tsx` – Foto bearbeiten
- [x] `src/app/admin/videos/page.tsx` – Video-Liste
- [x] `src/app/admin/tags/page.tsx` – Tag-Verwaltung
- [x] `src/app/admin/kommentare/page.tsx` – Kommentar-Moderation
- [x] `src/app/admin/benutzer/page.tsx` – Benutzer-Liste
- [x] `src/app/admin/benutzer/neu/page.tsx` – Benutzer erstellen
- [x] `src/app/admin/benutzer/[id]/edit/page.tsx` – Benutzer bearbeiten
- [x] `src/app/admin/gruppen/page.tsx` – Gruppen & Rechte (read-only)
- [x] `src/app/admin/einstellungen/page.tsx` – Einstellungen

### Öffentliche Seiten (✅ fertig)
- [x] `src/app/alben/[slug]/page.tsx` – Album-Ansicht (öffentlich)
- [x] `src/app/profil/page.tsx` – Benutzer-Profil
