-- Continuity: drop the mock-output tables.
-- These stored the UI's rendered cards, not the real domain. The provenance
-- card must be DERIVED from the electrical graph via a query instead.
DROP TABLE IF EXISTS provenance_attributes CASCADE;
DROP TABLE IF EXISTS provenance_rows CASCADE;
DROP TABLE IF EXISTS rails CASCADE;
