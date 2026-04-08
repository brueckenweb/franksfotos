-- Migration: fotogruppe_id Spalte in fd_gpx hinzufügen
-- Verknüpfung GPX-Track → fd_fotogruppen (many-to-one, optional)
-- Ausführen via: mariadb -u USER -p DATENBANK < add-gpx-fotogruppe.sql

ALTER TABLE fd_gpx
  ADD COLUMN fotogruppe_id INT NULL DEFAULT NULL COMMENT 'Verknüpfung zu fd_fotogruppen.idfgruppe',
  ADD INDEX idx_fd_gpx_fotogruppe_id (fotogruppe_id);

-- Keine FK-Constraint (soft reference), da idfgruppe BIGINT, fotogruppe_id INT
-- Die Integrität wird auf Anwendungsebene sichergestellt.
