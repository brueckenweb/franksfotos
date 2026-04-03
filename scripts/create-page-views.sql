-- ============================================================
-- Zugriffsstatistik: page_views Tabelle
-- Ausführen mit: mysql -u USER -p DBNAME < scripts/create-page-views.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS `page_views` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `path`        VARCHAR(1000) NOT NULL,
  `user_id`     INT          NULL DEFAULT NULL,
  `ip_address`  VARCHAR(45)  NULL DEFAULT NULL,
  `user_agent`  VARCHAR(500) NULL DEFAULT NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `page_views_path_idx`    (`path`(255)),
  INDEX `page_views_user_idx`    (`user_id`),
  INDEX `page_views_created_idx` (`created_at`),

  CONSTRAINT `fk_page_views_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
