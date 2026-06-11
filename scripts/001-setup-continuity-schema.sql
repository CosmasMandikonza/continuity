-- Continuity diagnostic instrument — core schema
-- Models the "database rows" that back each citation chip, plus power rails.

-- Provenance rows: the components (comp) and nets (net) behind each citation chip.
CREATE TABLE IF NOT EXISTS provenance_rows (
  id          SERIAL PRIMARY KEY,
  -- stable lookup key used by the UI chip (e.g. 'U7', 'C29', 'PP5V0')
  ref_key     VARCHAR(32) NOT NULL UNIQUE,
  kind        VARCHAR(8)  NOT NULL CHECK (kind IN ('comp', 'net')),
  -- displayed refdes / net name (e.g. 'U7', 'PP5V0_SYS')
  rd          VARCHAR(64) NOT NULL,
  src         VARCHAR(128) NOT NULL,
  conf        NUMERIC(4,2) NOT NULL CHECK (conf >= 0 AND conf <= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attribute grid for each provenance row (ordered key/value pairs).
CREATE TABLE IF NOT EXISTS provenance_attributes (
  id          SERIAL PRIMARY KEY,
  row_id      INT NOT NULL REFERENCES provenance_rows(id) ON DELETE CASCADE,
  position    INT NOT NULL,
  attr_key    VARCHAR(32) NOT NULL,
  attr_value  VARCHAR(128) NOT NULL,
  UNIQUE (row_id, position)
);

CREATE INDEX IF NOT EXISTS idx_provenance_attributes_row_id
  ON provenance_attributes(row_id);

-- Power rails shown in the left instrument module.
CREATE TABLE IF NOT EXISTS rails (
  id          SERIAL PRIMARY KEY,
  position    INT NOT NULL,
  state       VARCHAR(8) NOT NULL CHECK (state IN ('ok', 'warn', 'dead')),
  name        VARCHAR(64) NOT NULL,
  value       VARCHAR(32) NOT NULL,
  UNIQUE (position)
);
