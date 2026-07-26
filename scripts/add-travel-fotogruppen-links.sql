-- Verknüpft Reisekarten-Einträge (Länder, Städte, Sehenswürdigkeiten)
-- mit Fotogruppen aus fd_fotogruppen
--
-- Ausführen: mysql -u root -p franksfotos < scripts/add-travel-fotogruppen-links.sql
-- Migration: Verknüpfungstabelle travel_fotogruppen_links

CREATE TABLE IF NOT EXISTS `travel_fotogruppen_links` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `entity_type`      VARCHAR(10) NOT NULL COMMENT 'country | city | sight',
  `entity_id`        INT NOT NULL COMMENT 'ID aus travel_countries / travel_cities / travel_sights',
  `map_id`           INT NOT NULL COMMENT 'travel_maps.id – für schnelle Karten-Abfragen',
  `fotogruppe_id`    BIGINT NOT NULL COMMENT 'fd_fotogruppen.idfgruppe (soft-ref)',
  `fotogruppe_name`  VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'denormalisiert für Performance',
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_entity_fotogruppe` (`entity_type`, `entity_id`, `fotogruppe_id`),
  KEY `idx_entity` (`entity_type`, `entity_id`),
  KEY `idx_map` (`map_id`),
  KEY `idx_fotogruppe` (`fotogruppe_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
