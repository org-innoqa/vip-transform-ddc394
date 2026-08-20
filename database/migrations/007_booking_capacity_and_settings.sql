-- Keep the booking API backed by an initialized, editable pricing row and
-- expose capacity filtering as a server-side query for the public flow.
INSERT INTO pricing_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Correct constraints created by early notification migrations for existing databases.
ALTER TABLE pricing_settings DROP CONSTRAINT IF EXISTS pricing_settings_operations_email_check;
ALTER TABLE pricing_settings ADD CONSTRAINT pricing_settings_operations_email_check
  CHECK (operations_email IS NULL OR operations_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
ALTER TABLE reservation_notifications DROP CONSTRAINT IF EXISTS reservation_notifications_recipient_email_check;
ALTER TABLE reservation_notifications ADD CONSTRAINT reservation_notifications_recipient_email_check
  CHECK (recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

CREATE OR REPLACE FUNCTION list_available_vehicles(
  p_passenger_count integer DEFAULT 1,
  p_luggage_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  model text,
  passenger_capacity integer,
  luggage_capacity integer,
  multiplier numeric,
  equipment text[],
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT v.id, v.model, v.passenger_capacity, v.luggage_capacity,
         v.multiplier, v.equipment, v.image_url
  FROM vehicles AS v
  WHERE v.is_active
    AND p_passenger_count BETWEEN 1 AND 100
    AND p_luggage_count BETWEEN 0 AND 100
    AND v.passenger_capacity >= p_passenger_count
    AND v.luggage_capacity >= p_luggage_count
  ORDER BY v.passenger_capacity, v.luggage_capacity, v.model;
$$;

GRANT EXECUTE ON FUNCTION list_available_vehicles(integer, integer) TO anon, authenticated;
