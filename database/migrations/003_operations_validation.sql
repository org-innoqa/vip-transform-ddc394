-- Tighten operational data validation without changing existing table definitions.
-- This migration is safe to apply more than once.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_model_not_blank') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_model_not_blank CHECK (length(btrim(model)) BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_image_url_https') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_image_url_https CHECK (image_url IS NULL OR image_url ~ '^https://[^[:space:]]+$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zones_name_not_blank') THEN
    ALTER TABLE zones ADD CONSTRAINT zones_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extras_name_not_blank') THEN
    ALTER TABLE extras ADD CONSTRAINT extras_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_code_not_blank') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_code_not_blank CHECK (length(btrim(code)) BETWEEN 6 AND 64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_sessions_token_format') THEN
    ALTER TABLE admin_sessions ADD CONSTRAINT admin_sessions_token_format CHECK (token ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reservations_code_idx ON reservations (code);
CREATE INDEX IF NOT EXISTS admin_users_active_username_idx ON admin_users (is_active, username);
