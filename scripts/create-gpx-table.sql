-- ============================================================
-- GPX-Track-Tabelle für FranksFotos
-- Prefix: fd_ (Fotodatenbank-Bereich)
-- Erstellt: 2026-04-06
-- ============================================================

CREATE TABLE IF NOT EXISTS fd_gpx (
  id            INT           NOT NULL AUTO_INCREMENT,
  titel         VARCHAR(255)  NOT NULL,
  beschreibung  TEXT,
  typ           ENUM('Wanderung','Autofahrt','Fahrrad','Schifffahrt','Flugzeug') NOT NULL DEFAULT 'Wanderung',
  land          VARCHAR(100),
  laenge_km     DECIMAL(8,2),          -- Streckenlänge in km (automatisch ermittelt)
  hoehenm_auf   INT,                   -- positiver Höhenunterschied in m (automatisch ermittelt)
  datum_tour    DATE,                  -- Datum der Tour (aus erstem GPX-Zeitstempel)
  album_id      INT            DEFAULT NULL,
  gpx_dateiname VARCHAR(255)   NOT NULL DEFAULT '',
  gpx_url       VARCHAR(500)   NOT NULL,
  eingetragen   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id       INT            NOT NULL,

  PRIMARY KEY (id),
  INDEX idx_gpx_album    (album_id),
  INDEX idx_gpx_user     (user_id),
  INDEX idx_gpx_typ      (typ),
  INDEX idx_gpx_land     (land),
  INDEX idx_gpx_datum    (datum_tour),

  CONSTRAINT fk_gpx_album  FOREIGN KEY (album_id) REFERENCES albums(id)  ON DELETE SET NULL,
  CONSTRAINT fk_gpx_user   FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
