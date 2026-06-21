-- ============================================================
-- Migration: Unteralbum-Gesamtdiashow
-- Datum: 2026-06-21
-- ============================================================

-- 1. Neues Feld in der albums-Tabelle
ALTER TABLE albums
  ADD COLUMN subalbum_slideshow_enabled TINYINT(1) NOT NULL DEFAULT 0
  AFTER photo_sort_mode;

-- 2. Neue Tabelle für Diashow-Hintergrundmusik
CREATE TABLE album_slideshow_music (
  id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  album_id     INT          NOT NULL,
  filename     VARCHAR(500) NOT NULL,
  file_url     VARCHAR(1000) NOT NULL,
  title        VARCHAR(255),
  duration_sec INT,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX slideshow_music_album_idx (album_id),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
