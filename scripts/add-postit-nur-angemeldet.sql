-- ============================================================
-- Migration: PostIt sichtbarkeit Feld hinzufügen
-- ============================================================
-- Fügt das Feld "sichtbarkeit" zur Tabelle post_it_notes hinzu.
-- Mögliche Werte:
--   "alle"              → für alle Besucher sichtbar (Standard)
--   "angemeldet"        → nur für eingeloggte Nutzer
--   "nicht_angemeldet"  → nur für nicht eingeloggte Besucher

ALTER TABLE post_it_notes
  ADD COLUMN sichtbarkeit VARCHAR(20) NOT NULL DEFAULT 'alle'
    COMMENT 'alle | angemeldet | nicht_angemeldet'
    AFTER is_active;

-- Index für schnelle Filterung
ALTER TABLE post_it_notes
  ADD INDEX idx_sichtbarkeit (sichtbarkeit);
