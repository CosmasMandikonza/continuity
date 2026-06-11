-- Continuity: seed the real MNT Reform topology (shared) + synthetic repair history.
-- Idempotent: safe to re-run.

-- ===========================================================================
-- SHARED DEVICE: MNT Reform
-- ===========================================================================
INSERT INTO devices (id, name, revision, manufacturer, is_shared, tenant_id)
VALUES ('d0000000-0000-0000-0000-000000000001', 'MNT Reform', 'r3', 'MNT Research', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- NETS ----------------------------------------------------------------------
INSERT INTO nets (id, device_id, name, net_class, nominal_v) VALUES
  ('11110000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'VBAT',       'power', 16.800),
  ('11110000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'PP5V0_SYS',  'power',  5.000),
  ('11110000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'PP3V3_SYS',  'power',  3.300),
  ('11110000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'PP1V8',      'power',  1.800)
ON CONFLICT (device_id, name) DO NOTHING;

-- COMPONENTS ----------------------------------------------------------------
INSERT INTO components (id, device_id, refdes, kind, value, package, mpn, source_ref, confidence) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'J15',  'connector',  'BARREL_5.5x2.1', 'TH',      'PJ-102AH',        'reform-sys.pdf p.4', 0.990),
  ('c0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', 'U7',   'regulator',  'TPS54560',       'HSOIC-8', 'TPS54560DDAR',    'reform-sys.pdf p.7', 0.970),
  ('c0000000-0000-0000-0000-00000000001a', 'd0000000-0000-0000-0000-000000000001', 'U1',   'soc',        'i.MX8MQ',        'FCBGA',   'MIMX8MQ6DVAJZAA', 'reform-sys.pdf p.2', 0.940),
  ('c0000000-0000-0000-0000-000000000029', 'd0000000-0000-0000-0000-000000000001', 'C29',  'capacitor',  '22uF',           '0805',    'GRM21BR61E226', 'reform-sys.pdf p.7', 0.910),
  ('c0000000-0000-0000-0000-000000000031', 'd0000000-0000-0000-0000-000000000001', 'C31',  'capacitor',  '10uF',           '0603',    'GRM188R61A106', 'reform-sys.pdf p.7', 0.900),
  ('c0000000-0000-0000-0000-000000000042', 'd0000000-0000-0000-0000-000000000001', 'R42',  'resistor',   '100k',           '0402',    'RC0402FR-07100K','reform-sys.pdf p.7', 0.880),
  ('c0000000-0000-0000-0000-00000000c012', 'd0000000-0000-0000-0000-000000000001', 'TP12', 'testpoint',  'PP5V0_SYS',      'TH',      NULL,             'reform-sys.pdf p.7', 0.820)
ON CONFLICT (device_id, refdes) DO NOTHING;

-- PINS (with net membership) ------------------------------------------------
-- J15 barrel jack: pin1 -> VBAT
INSERT INTO pins (component_id, number, name, role, net_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', '1', 'TIP',  'power_in',  '11110000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', '2', 'GND',  'ground',    NULL),
  -- U7 buck: VIN<-VBAT, SW/VOUT->PP5V0_SYS, EN gated by R42
  ('c0000000-0000-0000-0000-000000000007', '1', 'VIN',  'power_in',  '11110000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000007', '3', 'EN',   'enable',    '11110000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000007', '8', 'VOUT', 'power_out', '11110000-0000-0000-0000-000000000002'),
  -- C29 / C31 bulk + decoupling on PP5V0_SYS
  ('c0000000-0000-0000-0000-000000000029', '1', 'A',    'bypass',    '11110000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000029', '2', 'B',    'ground',    NULL),
  ('c0000000-0000-0000-0000-000000000031', '1', 'A',    'bypass',    '11110000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000031', '2', 'B',    'ground',    NULL),
  -- R42 EN pullup between VBAT and U7.EN
  ('c0000000-0000-0000-0000-000000000042', '1', 'A',    'pullup',    '11110000-0000-0000-0000-000000000001'),
  -- U1 SoC powered from PP5V0_SYS -> internal rails
  ('c0000000-0000-0000-0000-00000000001a','b12','VDD_5V','power_in', '11110000-0000-0000-0000-000000000002'),
  -- TP12 probe point on PP5V0_SYS
  ('c0000000-0000-0000-0000-00000000c012', '1', 'TP',   'probe',     '11110000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- EDGES (the electrical graph) ----------------------------------------------
INSERT INTO edges (device_id, src_component_id, dst_component_id, kind, via_net_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'powers',  '11110000-0000-0000-0000-000000000001'), -- J15 -> U7
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000042', 'c0000000-0000-0000-0000-000000000007', 'enables', '11110000-0000-0000-0000-000000000001'), -- R42 -> U7.EN
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000001a', 'powers',  '11110000-0000-0000-0000-000000000002'), -- U7 -> U1
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000029', 'connects','11110000-0000-0000-0000-000000000002'), -- U7 -> C29
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000031', 'connects','11110000-0000-0000-0000-000000000002'), -- U7 -> C31
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000c012', 'connects','11110000-0000-0000-0000-000000000002')  -- U7 -> TP12
ON CONFLICT DO NOTHING;

-- BOOT PHASES ---------------------------------------------------------------
INSERT INTO boot_phases (device_id, seq, name, rail_net_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 1, 'DC input present',   '11110000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 2, '5V rail up',         '11110000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000001', 3, '3V3 rail up',        '11110000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000001', 4, '1V8 rail up',        '11110000-0000-0000-0000-000000000004')
ON CONFLICT (device_id, seq) DO NOTHING;

-- ===========================================================================
-- SYNTHETIC REPAIR HISTORY across 3 fake tenants (for failureRate)
-- ===========================================================================
INSERT INTO tenants (id, name) VALUES
  ('a0000000-0000-0000-0000-0000000000a1', 'Northwind Repairs'),
  ('a0000000-0000-0000-0000-0000000000a2', 'Bench & Board Co'),
  ('a0000000-0000-0000-0000-0000000000a3', 'Volt Clinic')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, name, role) VALUES
  ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000a1', 'sam@northwind.test',  'Sam Ortiz',  'owner'),
  ('b0000000-0000-0000-0000-0000000000b2', 'a0000000-0000-0000-0000-0000000000a2', 'lee@benchboard.test', 'Lee Park',   'owner'),
  ('b0000000-0000-0000-0000-0000000000b3', 'a0000000-0000-0000-0000-0000000000a3', 'rio@voltclinic.test', 'Rio Mendez', 'owner')
ON CONFLICT (email) DO NOTHING;

-- 12 resolved "no power" repairs; confirmed root cause distribution:
--   C29 (short) x7, U7 (dead buck) x3, J15 (bad jack) x1, R42 (open pullup) x1  => C29 ≈ 58%
DO $$
DECLARE
  dev   UUID := 'd0000000-0000-0000-0000-000000000001';
  c29   UUID := 'c0000000-0000-0000-0000-000000000029';
  u7    UUID := 'c0000000-0000-0000-0000-000000000007';
  j15   UUID := 'c0000000-0000-0000-0000-000000000001';
  r42   UUID := 'c0000000-0000-0000-0000-000000000042';
  rid   UUID;
  i     INT;
  tn    UUID;
  usr   UUID;
  cause UUID;
  causes UUID[] := ARRAY[c29,c29,c29,c29,c29,c29,c29, u7,u7,u7, j15, r42];
  tenants_arr UUID[] := ARRAY[
    'a0000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-0000000000a2','a0000000-0000-0000-0000-0000000000a3'];
  users_arr UUID[] := ARRAY[
    'b0000000-0000-0000-0000-0000000000b1','b0000000-0000-0000-0000-0000000000b2','b0000000-0000-0000-0000-0000000000b3'];
BEGIN
  -- only seed once
  IF EXISTS (SELECT 1 FROM repairs WHERE ref LIKE 'SEED-%') THEN
    RETURN;
  END IF;
  FOR i IN 1..12 LOOP
    tn    := tenants_arr[((i-1) % 3) + 1];
    usr   := users_arr[((i-1) % 3) + 1];
    cause := causes[i];
    rid   := gen_random_uuid();
    INSERT INTO repairs (id, tenant_id, device_id, user_id, ref, status, symptom)
      VALUES (rid, tn, dev, usr, 'SEED-' || lpad(i::text,3,'0'), 'resolved', 'no power');
    INSERT INTO findings (repair_id, component_id, kind, confidence, status)
      VALUES (rid, cause, 'root_cause', 0.900, 'confirmed');
  END LOOP;
END $$;
