-- ============================================================
-- Weltreise-Modul: Neue Tabellen für FranksFotos
-- Ausführen: mysql -u USER -p DATENBANK < create-reisen-tables.sql
-- ============================================================

-- Neue Permissions einfügen
INSERT IGNORE INTO permissions (name, label, description, category) VALUES
  ('view_travel_map',  'Weltreise-Karte ansehen',   'Bereiste Länder-Karte ansehen', 'reisen'),
  ('edit_travel_map',  'Weltreise-Karte bearbeiten', 'Bereiste Länder eintragen und bearbeiten', 'reisen');

-- ============================================================
-- Tabelle: travel_maps
-- ============================================================
CREATE TABLE IF NOT EXISTS travel_maps (
  id          INT         NOT NULL AUTO_INCREMENT,
  user_id     INT         NOT NULL,
  name        VARCHAR(255) NOT NULL DEFAULT 'Meine Weltreise',
  description TEXT,
  partner_id  INT         DEFAULT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX travel_maps_user_idx    (user_id),
  INDEX travel_maps_partner_idx (partner_id),
  CONSTRAINT fk_travel_maps_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_travel_maps_partner FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Tabelle: travel_countries
-- ============================================================
CREATE TABLE IF NOT EXISTS travel_countries (
  id           INT          NOT NULL AUTO_INCREMENT,
  map_id       INT          NOT NULL,
  country_code VARCHAR(2)   NOT NULL,
  country_name VARCHAR(100) NOT NULL DEFAULT '',
  visited_by   VARCHAR(10)  NOT NULL DEFAULT 'user1',  -- 'user1'|'user2'|'both'
  visited_at   DATE         DEFAULT NULL,
  notes        TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX travel_countries_unique (map_id, country_code),
  INDEX travel_countries_map_idx (map_id),
  CONSTRAINT fk_travel_countries_map FOREIGN KEY (map_id) REFERENCES travel_maps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Tabelle: travel_cities
-- ============================================================
CREATE TABLE IF NOT EXISTS travel_cities (
  id           INT          NOT NULL AUTO_INCREMENT,
  map_id       INT          NOT NULL,
  name         VARCHAR(255) NOT NULL,
  country_code VARCHAR(2)   NOT NULL,
  country_name VARCHAR(100) NOT NULL DEFAULT '',
  lat          VARCHAR(20)  DEFAULT NULL,
  lng          VARCHAR(20)  DEFAULT NULL,
  visited_by   VARCHAR(10)  NOT NULL DEFAULT 'user1',
  visited_at   DATE         DEFAULT NULL,
  notes        TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX travel_cities_map_idx (map_id),
  CONSTRAINT fk_travel_cities_map FOREIGN KEY (map_id) REFERENCES travel_maps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Tabelle: travel_sights
-- ============================================================
CREATE TABLE IF NOT EXISTS travel_sights (
  id           INT          NOT NULL AUTO_INCREMENT,
  map_id       INT          NOT NULL,
  city_id      INT          DEFAULT NULL,
  name         VARCHAR(255) NOT NULL,
  category     VARCHAR(50)  NOT NULL DEFAULT 'Sonstiges',
  country_code VARCHAR(2)   NOT NULL,
  country_name VARCHAR(100) NOT NULL DEFAULT '',
  lat          VARCHAR(20)  DEFAULT NULL,
  lng          VARCHAR(20)  DEFAULT NULL,
  visited_by   VARCHAR(10)  NOT NULL DEFAULT 'user1',
  visited_at   DATE         DEFAULT NULL,
  notes        TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX travel_sights_map_idx  (map_id),
  INDEX travel_sights_city_idx (city_id),
  CONSTRAINT fk_travel_sights_map  FOREIGN KEY (map_id)   REFERENCES travel_maps(id)   ON DELETE CASCADE,
  CONSTRAINT fk_travel_sights_city FOREIGN KEY (city_id)  REFERENCES travel_cities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
