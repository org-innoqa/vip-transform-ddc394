-- Admin operations and server-validated sessions for the VIP Transform console.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 160),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token text PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions (expires_at);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE token = current_setting('request.headers', true)::json->>'x-admin-session'
      AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION admin_login(p_username text, p_password text)
RETURNS TABLE (token text, username text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u admin_users; session_token text;
BEGIN
  SELECT * INTO u FROM admin_users WHERE admin_users.username = lower(trim(p_username)) AND is_active;
  IF u.id IS NULL OR NOT crypt(p_password, u.password_hash) = u.password_hash THEN
    RAISE EXCEPTION 'invalid_credentials' USING ERRCODE = '28000';
  END IF;
  session_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO admin_sessions(token, admin_user_id, expires_at)
  VALUES (session_token, u.id, now() + interval '8 hours');
  RETURN QUERY SELECT session_token, u.username, now() + interval '8 hours';
END;
$$;

CREATE OR REPLACE FUNCTION admin_logout(p_token text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ DELETE FROM admin_sessions WHERE token = p_token; $$;

-- Expired sessions are harmless, but this keeps the table compact when login is used often.
CREATE OR REPLACE FUNCTION purge_expired_admin_sessions() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ DELETE FROM admin_sessions WHERE expires_at <= now(); $$;

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_public_read ON vehicles;
CREATE POLICY vehicles_public_read ON vehicles FOR SELECT USING (is_active OR is_admin_session());
DROP POLICY IF EXISTS vehicles_admin_write ON vehicles;
CREATE POLICY vehicles_admin_write ON vehicles FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
DROP POLICY IF EXISTS zones_public_read ON zones;
CREATE POLICY zones_public_read ON zones FOR SELECT USING (is_active OR is_admin_session());
DROP POLICY IF EXISTS zones_admin_write ON zones;
CREATE POLICY zones_admin_write ON zones FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
DROP POLICY IF EXISTS price_rules_public_read ON price_rules;
CREATE POLICY price_rules_public_read ON price_rules FOR SELECT USING (is_active OR is_admin_session());
DROP POLICY IF EXISTS price_rules_admin_write ON price_rules;
CREATE POLICY price_rules_admin_write ON price_rules FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
DROP POLICY IF EXISTS extras_public_read ON extras;
CREATE POLICY extras_public_read ON extras FOR SELECT USING (is_active OR is_admin_session());
DROP POLICY IF EXISTS extras_admin_write ON extras;
CREATE POLICY extras_admin_write ON extras FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
DROP POLICY IF EXISTS reservations_admin_only ON reservations;
CREATE POLICY reservations_admin_only ON reservations FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
DROP POLICY IF EXISTS reservation_extras_admin_only ON reservation_extras;
CREATE POLICY reservation_extras_admin_only ON reservation_extras FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
DROP POLICY IF EXISTS pricing_settings_public_read ON pricing_settings;
CREATE POLICY pricing_settings_public_read ON pricing_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS pricing_settings_admin_write ON pricing_settings;
CREATE POLICY pricing_settings_admin_write ON pricing_settings FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- Provision an operator with: INSERT INTO admin_users(username,password_hash)
-- VALUES ('admin@example.com', crypt('CHANGE_ME', gen_salt('bf')));
