-- Allow the public booking flow to create a new reservation, while keeping reads,
-- updates and deletes restricted to authenticated operators. Server-side database
-- constraints still enforce valid enum, foreign-key, consent and amount fields.
DROP POLICY IF EXISTS reservations_public_insert ON reservations;
CREATE POLICY reservations_public_insert ON reservations FOR INSERT
  WITH CHECK (status = 'new' AND kvkk_consent_at IS NOT NULL AND calculated_amount >= 0);

DROP POLICY IF EXISTS reservation_extras_public_insert ON reservation_extras;
CREATE POLICY reservation_extras_public_insert ON reservation_extras FOR INSERT
  WITH CHECK (quantity > 0 AND unit_price >= 0);
