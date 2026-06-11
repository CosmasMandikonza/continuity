-- Align U7's canonical part identity with the MNT Reform reference boardview.
-- (Seed 006 used a placeholder MPN; the reference buck is the TPS62840 / WSON-8.)
UPDATE components
SET value      = 'TPS62840',
    package    = 'WSON-8',
    mpn        = 'TPS62840DLCR',
    source_ref = 'reform-sys.pdf p.7'
WHERE device_id = 'd0000000-0000-0000-0000-000000000001'
  AND refdes = 'U7';
