-- Server-side quote endpoint for live estimates.
-- The booking RPC remains authoritative and recalculates the same inputs on insert.

CREATE OR REPLACE FUNCTION calculate_reservation_quote(
  p_origin_zone_id uuid,
  p_destination_zone_id uuid,
  p_vehicle_id uuid,
  p_pickup_at timestamptz,
  p_is_round_trip boolean DEFAULT false,
  p_passenger_count integer DEFAULT 1,
  p_luggage_count integer DEFAULT 0,
  p_extras jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (calculated_amount numeric, currency_code char(3))
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vehicle vehicles%ROWTYPE;
  v_rule price_rules%ROWTYPE;
  v_settings pricing_settings%ROWTYPE;
  v_base numeric(12, 2);
  v_extra numeric(12, 2) := 0;
  v_extra_row jsonb;
  v_extra_id uuid;
  v_quantity integer;
  v_extra_price numeric(12, 2);
BEGIN
  IF p_origin_zone_id IS NULL OR p_destination_zone_id IS NULL
     OR p_origin_zone_id = p_destination_zone_id
     OR p_pickup_at IS NULL OR p_pickup_at <= now()
     OR p_passenger_count IS NULL OR p_passenger_count < 1 OR p_passenger_count > 100
     OR p_luggage_count IS NULL OR p_luggage_count < 0 OR p_luggage_count > 100
     OR jsonb_typeof(coalesce(p_extras, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid_quote' USING ERRCODE = '22023';
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
  IF coalesce(p_is_round_trip, false) THEN
    v_base := v_base * 2 * (1 - v_settings.round_trip_discount_percent / 100);
  END IF;
  IF (v_settings.night_start < v_settings.night_end AND p_pickup_at::time >= v_settings.night_start AND p_pickup_at::time < v_settings.night_end)
     OR (v_settings.night_start > v_settings.night_end AND (p_pickup_at::time >= v_settings.night_start OR p_pickup_at::time < v_settings.night_end)) THEN
    v_base := v_base * (1 + v_settings.night_surcharge_percent / 100);
  END IF;
  FOR v_extra_row IN SELECT value FROM jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) LOOP
    BEGIN
      v_extra_id := (v_extra_row->>'extra_id')::uuid;
      v_quantity := (v_extra_row->>'quantity')::integer;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_extra' USING ERRCODE = '22023';
    END;
    IF v_extra_id IS NULL OR v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 20 THEN
      RAISE EXCEPTION 'invalid_extra_quantity' USING ERRCODE = '22023';
    END IF;
    SELECT price INTO v_extra_price FROM extras WHERE id = v_extra_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'extra_not_available' USING ERRCODE = '23503'; END IF;
    v_extra := v_extra + v_extra_price * v_quantity;
  END LOOP;
  RETURN QUERY SELECT round(v_base + v_extra, 2), v_settings.currency_code;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_reservation_quote(uuid, uuid, uuid, timestamptz, boolean, integer, integer, jsonb) TO anon, authenticated;
