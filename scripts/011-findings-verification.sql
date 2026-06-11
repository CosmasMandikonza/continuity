-- Continuity: let the deterministic verifier stamp its result onto a finding.
-- The agent proposes; the database adjudicates. status stays 'proposed' until a
-- human confirms — verified is a separate, machine-set fact.

ALTER TABLE findings ADD COLUMN IF NOT EXISTS verified BOOLEAN;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS verification JSONB;
