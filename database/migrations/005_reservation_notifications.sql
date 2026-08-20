-- Queue observable email notifications as part of the trusted booking transaction.
-- A platform mail worker can deliver queued rows without changing booking integrity.

ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS operations_email text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_settings_operations_email_check') THEN
    ALTER TABLE pricing_settings ADD CONSTRAINT pricing_settings_operations_email_check
      CHECK (operations_email IS NULL OR operations_email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS reservation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('customer', 'company')),
  recipient_email text NOT NULL CHECK (recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'),
  template_key text NOT NULL DEFAULT 'reservation_created',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  provider_message_id text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, recipient_type, recipient_email)
);

CREATE INDEX IF NOT EXISTS reservation_notifications_delivery_idx
  ON reservation_notifications (status, queued_at);
CREATE INDEX IF NOT EXISTS reservation_notifications_reservation_idx
  ON reservation_notifications (reservation_id);
ALTER TABLE reservation_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservation_notifications_admin_only ON reservation_notifications;
CREATE POLICY reservation_notifications_admin_only ON reservation_notifications
  FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
REVOKE ALL ON reservation_notifications FROM anon, authenticated;
GRANT SELECT ON reservation_notifications TO authenticated;

CREATE OR REPLACE FUNCTION create_reservation(
  p_service_type text, p_origin_zone_id uuid, p_destination_zone_id uuid,
  p_vehicle_id uuid, p_pickup_at timestamptz, p_is_round_trip boolean,
  p_passenger_count integer, p_luggage_count integer, p_flight_number text,
  p_customer_name text, p_customer_phone text, p_customer_email text,
  p_customer_note text, p_kvkk_consent_at timestamptz,
  p_honeypot text DEFAULT '', p_extras jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (id uuid, code text, calculated_amount numeric, currency_code char(3))
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vehicle vehicles%ROWTYPE;
  v_rule price_rules%ROWTYPE;
  v_settings pricing_settings%ROWTYPE;
  v_reservation_id uuid;
  v_code text;
  v_base numeric(12, 2);
  v_extra numeric(12, 2) := 0;
  v_amount numeric(12, 2);
  v_extra_row jsonb;
  v_extra_id uuid;
  v_quantity integer;
  v_extra_price numeric(12, 2);
  v_customer_email text := lower(trim(coalesce(p_customer_email, '')));
BEGIN
  IF nullif(trim(coalesce(p_honeypot, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  IF p_service_type NOT IN ('airport_transfer', 'chauffeured_rental', 'wedding_event', 'corporate_transfer')
     OR p_origin_zone_id IS NULL OR p_destination_zone_id IS NULL
     OR p_origin_zone_id = p_destination_zone_id
     OR p_passenger_count IS NULL OR p_passenger_count < 1 OR p_passenger_count > 100
     OR p_luggage_count IS NULL OR p_luggage_count < 0 OR p_luggage_count > 100
     OR p_pickup_at IS NULL OR p_pickup_at <= now()
     OR nullif(trim(coalesce(p_customer_name, '')), '') IS NULL
     OR length(trim(p_customer_name)) > 160
     OR nullif(trim(coalesce(p_customer_phone, '')), '') IS NULL
     OR length(trim(p_customer_phone)) > 40
     OR v_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
     OR length(v_customer_email) > 254
     OR p_kvkk_consent_at IS NULL THEN
    RAISE EXCEPTION 'invalid_reservation' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM zones WHERE id = p_origin_zone_id AND is_active)
     OR NOT EXISTS (SELECT 1 FROM zones WHERE id = p_destination_zone_id AND is_active) THEN
    RAISE EXCEPTION 'zone_not_available' USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_vehicle FROM vehicles
    WHERE id = p_vehicle_id AND is_active
      AND passenger_capacity >= p_passenger_count
      AND luggage_capacity >= p_luggage_count;
  IF NOT FOUND THEN RAISE EXCEPTION 'vehicle_not_available' USING ERRCODE = '23503'; END IF;

  SELECT * INTO v_rule FROM price_rules
    WHERE origin_zone_id = p_origin_zone_id AND destination_zone_id = p_destination_zone_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'price_rule_not_found' USING ERRCODE = '23503'; END IF;

  SELECT * INTO v_settings FROM pricing_settings WHERE id = 1;
  IF NOT FOUND THEN
    v_settings.round_trip_discount_percent := 0; v_settings.night_surcharge_percent := 0;
    v_settings.night_start := '00:00'; v_settings.night_end := '06:00'; v_settings.currency_code := 'QAR';
  END IF;

  v_base := v_rule.base_price * v_vehicle.multiplier;
  IF coalesce(p_is_round_trip, false) THEN
    v_base := v_base * 2 * (1 - v_settings.round_trip_discount_percent / 100);
  END IF;
  IF (v_settings.night_start < v_settings.night_end AND p_pickup_at::time >= v_settings.night_start AND p_pickup_at::time < v_settings.night_end)
     OR (v_settings.night_start > v_settings.night_end AND (p_pickup_at::time >= v_settings.night_start OR p_pickup_at::time < v_settings.night_end)) THEN
    v_base := v_base * (1 + v_settings.night_surcharge_percent / 100);
  END IF;

  IF jsonb_typeof(coalesce(p_extras, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid_extras' USING ERRCODE = '22023';
  END IF;
  FOR v_extra_row IN SELECT value FROM jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) LOOP
    BEGIN v_extra_id := (v_extra_row->>'extra_id')::uuid; v_quantity := (v_extra_row->>'quantity')::integer;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_extra' USING ERRCODE = '22023'; END;
    IF v_extra_id IS NULL OR v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 20 THEN
      RAISE EXCEPTION 'invalid_extra_quantity' USING ERRCODE = '22023';
    END IF;
    SELECT price INTO v_extra_price FROM extras WHERE id = v_extra_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'extra_not_available' USING ERRCODE = '23503'; END IF;
    v_extra := v_extra + v_extra_price * v_quantity;
  END LOOP;
  v_amount := round(v_base + v_extra, 2);
  v_code := 'VIP-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO reservations (code, service_type, origin_zone_id, destination_zone_id, vehicle_id, pickup_at,
    is_round_trip, passenger_count, luggage_count, flight_number, customer_name, customer_phone,
    customer_email, customer_note, calculated_amount, status, kvkk_consent_at)
  VALUES (v_code, p_service_type, p_origin_zone_id, p_destination_zone_id, p_vehicle_id, p_pickup_at,
    coalesce(p_is_round_trip, false), p_passenger_count, p_luggage_count, nullif(trim(p_flight_number), ''),
    trim(p_customer_name), trim(p_customer_phone), v_customer_email, nullif(trim(p_customer_note), ''), v_amount, 'new', p_kvkk_consent_at)
  RETURNING reservations.id INTO v_reservation_id;

  FOR v_extra_row IN SELECT value FROM jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) LOOP
    v_extra_id := (v_extra_row->>'extra_id')::uuid; v_quantity := (v_extra_row->>'quantity')::integer;
    SELECT price INTO v_extra_price FROM extras WHERE id = v_extra_id AND is_active;
    INSERT INTO reservation_extras (reservation_id, extra_id, quantity, unit_price)
    VALUES (v_reservation_id, v_extra_id, v_quantity, v_extra_price);
  END LOOP;

  INSERT INTO reservation_notifications (reservation_id, recipient_type, recipient_email)
  VALUES (v_reservation_id, 'customer', v_customer_email);
  IF v_settings.operations_email IS NOT NULL THEN
    INSERT INTO reservation_notifications (reservation_id, recipient_type, recipient_email)
    VALUES (v_reservation_id, 'company', lower(trim(v_settings.operations_email)));
  END IF;

  RETURN QUERY SELECT v_reservation_id, v_code, v_amount, v_settings.currency_code;
END;
$$;

GRANT EXECUTE ON FUNCTION create_reservation(text, uuid, uuid, uuid, timestamptz, boolean, integer, integer, text, text, text, text, timestamptz, text, jsonb) TO anon, authenticated;
