-- Continuity diagnostic instrument — seed data
-- Mirrors lib/continuity-data.ts (ROWS + RAILS). Idempotent via upserts.

-- ---- Provenance rows ----
INSERT INTO provenance_rows (ref_key, kind, rd, src, conf) VALUES
  ('U7',    'comp', 'U7',        'boardview · p.7',  0.98),
  ('C29',   'comp', 'C29',       'boardview · p.7',  0.95),
  ('J15',   'comp', 'J15',       'boardview · p.2',  0.99),
  ('PP5V0', 'net',  'PP5V0_SYS', 'electrical graph', 0.97)
ON CONFLICT (ref_key) DO UPDATE
  SET kind = EXCLUDED.kind,
      rd   = EXCLUDED.rd,
      src  = EXCLUDED.src,
      conf = EXCLUDED.conf,
      updated_at = now();

-- ---- Attribute grids ----
-- Clear existing attributes for these rows, then re-insert in order.
DELETE FROM provenance_attributes
WHERE row_id IN (SELECT id FROM provenance_rows WHERE ref_key IN ('U7','C29','J15','PP5V0'));

INSERT INTO provenance_attributes (row_id, position, attr_key, attr_value)
SELECT r.id, v.position, v.attr_key, v.attr_value
FROM provenance_rows r
JOIN (VALUES
  -- U7
  ('U7', 0, 'type',    'IC · buck regulator'),
  ('U7', 1, 'value',   'TPS62840'),
  ('U7', 2, 'package', 'WSON-8'),
  ('U7', 3, 'net',     'PP5V0_SYS'),
  ('U7', 4, 'pins',    '8'),
  -- C29
  ('C29', 0, 'type',    'capacitor'),
  ('C29', 1, 'value',   '10 µF'),
  ('C29', 2, 'package', '0402 · X5R'),
  ('C29', 3, 'net',     'PP5V0_SYS ↔ GND'),
  ('C29', 4, 'role',    'input decoupling'),
  -- J15
  ('J15', 0, 'type',    'connector · USB-C'),
  ('J15', 1, 'value',   'TYPE-C 16P'),
  ('J15', 2, 'package', 'recept SMT'),
  ('J15', 3, 'net',     'VBUS → PP5V0'),
  ('J15', 4, 'pins',    '16'),
  -- PP5V0
  ('PP5V0', 0, 'class',   'power rail'),
  ('PP5V0', 1, 'source',  'U7 pin 5'),
  ('PP5V0', 2, 'members', '37 pins'),
  ('PP5V0', 3, 'sinks',   'U1, U12, J9'),
  ('PP5V0', 4, 'nominal', '5.00 V')
) AS v(ref_key, position, attr_key, attr_value)
  ON v.ref_key = r.ref_key;

-- ---- Power rails ----
INSERT INTO rails (position, state, name, value) VALUES
  (0, 'dead', 'PP5V0_SYS', '0.31'),
  (1, 'warn', 'PP3V3_SYS', '2.90'),
  (2, 'ok',   'PP1V8',     '1.80'),
  (3, 'ok',   'VBAT',      '12.1')
ON CONFLICT (position) DO UPDATE
  SET state = EXCLUDED.state,
      name  = EXCLUDED.name,
      value = EXCLUDED.value;
