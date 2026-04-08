-- Migration: Passwort-Reset-Tokens Tabelle
-- Ausführen mit: mysql -u <user> -p <datenbank> < scripts/create-password-reset-tokens.sql

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `user_id`    INT           NOT NULL,
  `token`      VARCHAR(255)  NOT NULL,
  `expires_at` TIMESTAMP     NOT NULL,
  `used_at`    TIMESTAMP     NULL DEFAULT NULL,
  `created_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prt_token_idx` (`token`),
  KEY `prt_user_idx` (`user_id`),
  KEY `prt_expires_idx` (`expires_at`),
  CONSTRAINT `prt_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
