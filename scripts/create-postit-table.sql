-- ============================================================
-- Post-It Notes Tabelle
-- Haftnotizen, die auf verschiedenen Seiten der Fotogalerie
-- eingeblendet werden können.
-- ============================================================

CREATE TABLE IF NOT EXISTS post_it_notes (
  id          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  message     TEXT          NOT NULL,
  color       VARCHAR(20)   NOT NULL DEFAULT 'yellow'
                            COMMENT 'yellow | pink | blue | green | orange',
  slot        VARCHAR(100)  NOT NULL
                            COMMENT 'Eindeutige Kennung der Position, z.B. home, alben, weltreise',
  is_active   TINYINT(1)    NOT NULL DEFAULT 1
                            COMMENT '1 = sichtbar, 0 = ausgeblendet',
  created_by  INT           REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_slot     (slot),
  INDEX idx_active   (is_active),
  INDEX idx_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
