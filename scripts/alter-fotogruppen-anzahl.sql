-- ============================================================
-- Migration: anzahl-Spalte zu fd_fotogruppen hinzufügen
-- Ausführen in phpMyAdmin oder mysql-CLI:
--   mysql -u user -p datenbankname < alter-fotogruppen-anzahl.sql
-- ============================================================

-- 1. Spalte hinzufügen (falls noch nicht vorhanden)
ALTER TABLE fd_fotogruppen
  ADD COLUMN anzahl INT NOT NULL DEFAULT 0
  COMMENT 'Anzahl verknüpfter Fotos (Cache aus fd_fotogruppenverkn)';

-- 2. Nur inaktive Gruppen (einaktiv = 'nein') mit aktuellen Werten befüllen
--    Aktive Gruppen nutzen Lazy-Loading im Frontend – kein DB-Cache nötig.
UPDATE fd_fotogruppen fg
SET fg.anzahl = (
  SELECT COUNT(*)
  FROM fd_fotogruppenverkn fv
  WHERE fv.idfgruppe = fg.idfgruppe
)
WHERE fg.einaktiv = 'nein';
