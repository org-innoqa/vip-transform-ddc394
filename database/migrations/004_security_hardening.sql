-- Rate-limit administrator password attempts without storing passwords in the client.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  username text PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION admin_login(p_username text, p_password text)
RETURNS TABLE (token text, username text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u admin_users;
  normalized_username text := lower(trim(coalesce(p_username, '')));
  attempt admin_login_attempts;
  session_token text;
BEGIN
  IF length(normalized_username) < 3 OR length(coalesce(p_password, '')) < 8 THEN
    RAISE EXCEPTION 'invalid_credentials' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO attempt FROM admin_login_attempts WHERE username = normalized_username;
  IF attempt.locked_until IS NOT NULL AND attempt.locked_until > now() THEN
    RAISE EXCEPTION 'too_many_attempts' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO u FROM admin_users
    WHERE admin_users.username = normalized_username AND is_active;
  IF u.id IS NULL OR crypt(p_password, u.password_hash) <> u.password_hash THEN
    INSERT INTO admin_login_attempts(username, failed_count, locked_until, updated_at)
    VALUES (normalized_username, 1, NULL, now())
    ON CONFLICT (username) DO UPDATE SET
      failed_count = admin_login_attempts.failed_count + 1,
      locked_until = CASE WHEN admin_login_attempts.failed_count + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
      updated_at = now();
    RAISE EXCEPTION 'invalid_credentials' USING ERRCODE = '28000';
  END IF;

  DELETE FROM admin_login_attempts WHERE username = normalized_username;
  DELETE FROM admin_sessions WHERE expires_at <= now();
  session_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO admin_sessions(token, admin_user_id, expires_at)
    VALUES (session_token, u.id, now() + interval '8 hours');
  RETURN QUERY SELECT session_token, u.username, now() + interval '8 hours';
END;
$$;

REVOKE ALL ON admin_login_attempts FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_login(text, text) TO anon, authenticated;
