-- VIP Transform persistent data foundation.
-- The platform applies this file to the project's PostgreSQL database.

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  passenger_capacity integer NOT NULL CHECK (passenger_capacity > 0),
  luggage_capacity integer NOT NULL CHECK (luggage_capacity >= 0),
  multiplier numeric(8, 4) NOT NULL DEFAULT 1.0000 CHECK (multiplier > 0),
  equipment text[] NOT NULL DEFAULT '{}',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  destination_zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  base_price numeric(12, 2) NOT NULL CHECK (base_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_rules_origin_destination_unique UNIQUE (origin_zone_id, destination_zone_id)
);

CREATE TABLE IF NOT EXISTS extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  extra_type text NOT NULL CHECK (extra_type IN ('child_seat', 'welcome_sign', 'waiting_hour', 'extra_stop', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  service_type text NOT NULL CHECK (service_type IN ('airport_transfer', 'chauffeured_rental', 'wedding_event', 'corporate_transfer')),
  origin_zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  destination_zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  pickup_at timestamptz NOT NULL,
  is_round_trip boolean NOT NULL DEFAULT false,
  passenger_count integer NOT NULL CHECK (passenger_count > 0),
  luggage_count integer NOT NULL DEFAULT 0 CHECK (luggage_count >= 0),
  flight_number text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text NOT NULL,
  customer_note text,
  calculated_amount numeric(12, 2) NOT NULL CHECK (calculated_amount >= 0),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'completed', 'cancelled')),
  kvkk_consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation_extras (
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  extra_id uuid NOT NULL REFERENCES extras(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  PRIMARY KEY (reservation_id, extra_id)
);

CREATE TABLE IF NOT EXISTS pricing_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  round_trip_discount_percent numeric(5, 2) NOT NULL DEFAULT 0 CHECK (round_trip_discount_percent BETWEEN 0 AND 100),
  night_surcharge_percent numeric(5, 2) NOT NULL DEFAULT 0 CHECK (night_surcharge_percent BETWEEN 0 AND 100),
  night_start time NOT NULL DEFAULT '00:00',
  night_end time NOT NULL DEFAULT '06:00',
  currency_code char(3) NOT NULL DEFAULT 'QAR',
  operations_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('customer', 'company')),
  recipient_email text NOT NULL,
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

CREATE INDEX IF NOT EXISTS price_rules_origin_zone_idx ON price_rules (origin_zone_id);
CREATE INDEX IF NOT EXISTS price_rules_destination_zone_idx ON price_rules (destination_zone_id);
CREATE INDEX IF NOT EXISTS vehicles_active_capacity_idx ON vehicles (is_active, passenger_capacity, luggage_capacity);
CREATE INDEX IF NOT EXISTS extras_active_type_idx ON extras (is_active, extra_type);
CREATE INDEX IF NOT EXISTS reservations_status_created_at_idx ON reservations (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_pickup_at_idx ON reservations (pickup_at);
CREATE INDEX IF NOT EXISTS reservations_customer_email_idx ON reservations (customer_email);
CREATE INDEX IF NOT EXISTS reservation_extras_extra_id_idx ON reservation_extras (extra_id);
