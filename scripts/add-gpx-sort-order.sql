-- Migration: sortOrder-Spalte zur fd_gpx-Tabelle hinzufügen
-- Ausführen via: mysql -u USER -p DATENBANK < scripts/add-gpx-sort-order.sql

ALTER TABLE fd_gpx
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER datum_tour;

-- Index für schnelle Sortierung
CREATE INDEX fd_gpx_sort_idx ON fd_gpx (album_id, sort_order);
