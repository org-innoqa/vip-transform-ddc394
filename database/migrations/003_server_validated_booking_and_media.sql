-- Server-side reservation validation and deterministic pricing.
-- This migration is safe to apply after schema.sql and the admin migrations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_image_url_https_check'
  ) THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_image_url_https_check
      CHECK (image_url IS NULL OR image_url ~ '^https://');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION create_reservation(
  p_service_type text,
  p_origin_zone_id uuid,
  p_destination_zone_id uuid,
  p_vehicle_id uuid,
  p_pickup_at timestamptz,
  p_is_round_trip boolean,
  p_passenger_count integer,
  p_luggage_count integer,
  p_flight_number text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_customer_note text,
  p_kvkk_consent_at timestamptz,
  p_honeypot text DEFAULT '',
  p_extras jsonb DEFAULT '[]'::jsonb
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
BEGIN
  IF nullif(trim(coalesce(p_honeypot, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  IF p_service_type NOT IN ('airport_transfer', 'chauffeured_rental', 'wedding_event', 'corporate_transfer')
     OR p_origin_zone_id = p_destination_zone_id
     OR p_passenger_count IS NULL OR p_passenger_count < 1
     OR p_luggage_count IS NULL OR p_luggage_count < 0
     OR p_pickup_at IS NULL OR p_pickup_at <= now()
     OR nullif(trim(coalesce(p_customer_name, '')), '') IS NULL
     OR nullif(trim(coalesce(p_customer_phone, '')), '') IS NULL
     OR p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR p_kvkk_consent_at IS NULL THEN
    RAISE EXCEPTION 'invalid_reservation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_vehicle FROM vehicles
    WHERE id = p_vehicle_id AND is_active
      AND passenger_capacity >= p_passenger_count
      AND luggage_capacity >= p_luggage_count;
  IF NOT FOUND THEN RAISE EXCEPTION 'vehicle_not_available' USING ERRCODE = '23503'; END IF;

  SELECT * INTO v_rule FROM price_rules
    WHERE origin_zone_id = p_origin_zone_id
      AND destination_zone_id = p_destination_zone_id
      AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'price_rule_not_found' USING ERRCODE = '23503'; END IF;

  SELECT * INTO v_settings FROM pricing_settings WHERE id = 1;
  IF NOT FOUND THEN
    v_settings.round_trip_discount_percent := 0;
    v_settings.night_surcharge_percent := 0;
    v_settings.night_start := '00:00';
    v_settings.night_end := '06:00';
    v_settings.currency_code := 'QAR';
  END IF;

  v_base := v_rule.base_price * v_vehicle.multiplier;
  IF p_is_round_trip THEN
    v_base := v_base * 2 * (1 - v_settings.round_trip_discount_percent / 100);
  END IF;
  IF (v_settings.night_start < v_settings.night_end AND p_pickup_at::time >= v_settings.night_start AND p_pickup_at::time < v_settings.night_end)
     OR (v_settings.night_start > v_settings.night_end AND (p_pickup_at::time >= v_settings.night_start OR p_pickup_at::time < v_settings.night_end)) THEN
    v_base := v_base * (1 + v_settings.night_surcharge_percent / 100);
  END IF;

  FOR v_extra_row IN SELECT value FROM jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) LOOP
    v_extra_id := (v_extra_row->>'extra_id')::uuid;
    v_quantity := (v_extra_row->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 20 THEN
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
    trim(p_customer_name), trim(p_customer_phone), lower(trim(p_customer_email)), nullif(trim(p_customer_note), ''),
    v_amount, 'new', p_kvkk_consent_at)
  RETURNING reservations.id INTO v_reservation_id;

  FOR v_extra_row IN SELECT value FROM jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) LOOP
    v_extra_id := (v_extra_row->>'extra_id')::uuid;
    v_quantity := (v_extra_row->>'quantity')::integer;
    SELECT price INTO v_extra_price FROM extras WHERE id = v_extra_id AND is_active;
    INSERT INTO reservation_extras (reservation_id, extra_id, quantity, unit_price)
    VALUES (v_reservation_id, v_extra_id, v_quantity, v_extra_price);
  END LOOP;

  RETURN QUERY SELECT v_reservation_id, v_code, v_amount, v_settings.currency_code;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zones_name_not_blank_check') THEN
    ALTER TABLE zones ADD CONSTRAINT zones_name_not_blank_check CHECK (length(trim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extras_name_not_blank_check') THEN
    ALTER TABLE extras ADD CONSTRAINT extras_name_not_blank_check CHECK (length(trim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_rules_distinct_zones_check') THEN
    ALTER TABLE price_rules ADD CONSTRAINT price_rules_distinct_zones_check CHECK (origin_zone_id <> destination_zone_id);
  END IF;
END $$;

-- Do not expose a table insert that can bypass cross-table pricing and capacity checks.
-- Public callers use create_reservation(), which performs all validation atomically.
DROP POLICY IF EXISTS reservations_public_insert ON reservations;
DROP POLICY IF EXISTS reservation_extras_public_insert ON reservation_extras;

GRANT EXECUTE ON FUNCTION create_reservation(text, uuid, uuid, uuid, timestamptz, boolean, integer, integer, text, text, text, text, text, timestamptz, text, jsonb) TO anon, authenticated;
