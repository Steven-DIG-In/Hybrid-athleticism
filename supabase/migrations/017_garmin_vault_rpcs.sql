-- Migration 017: Garmin credentials Vault RPCs
-- Requires supabase_vault extension (installed in Supabase projects by default).
--
-- Adds three SECURITY DEFINER helpers for storing and reading Garmin credentials
-- via Supabase Vault:
--   - store_garmin_credentials(p_email, p_password)  -- upsert vault-backed creds
--   - read_secret(secret_id)                         -- read, owner-only
--   - disconnect_garmin()                            -- delete creds + secrets

CREATE OR REPLACE FUNCTION store_garmin_credentials(
  p_email text,
  p_password text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_id uuid;
  v_pass_id  uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Remove any existing secrets for this user so create_secret unique-name
  -- constraints don't collide on re-connect.
  DELETE FROM vault.secrets WHERE name IN (
    'garmin_email_'    || auth.uid()::text,
    'garmin_password_' || auth.uid()::text
  );

  v_email_id := vault.create_secret(p_email,    'garmin_email_'    || auth.uid()::text);
  v_pass_id  := vault.create_secret(p_password, 'garmin_password_' || auth.uid()::text);

  INSERT INTO garmin_credentials (user_id, vault_secret_id_email, vault_secret_id_password)
  VALUES (auth.uid(), v_email_id, v_pass_id)
  ON CONFLICT (user_id) DO UPDATE SET
    vault_secret_id_email    = EXCLUDED.vault_secret_id_email,
    vault_secret_id_password = EXCLUDED.vault_secret_id_password,
    connected_at             = now();
END $$;

CREATE OR REPLACE FUNCTION read_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Caller must own the credentials row that references this secret.
  IF NOT EXISTS (
    SELECT 1 FROM garmin_credentials
    WHERE user_id = auth.uid()
      AND (vault_secret_id_email = secret_id OR vault_secret_id_password = secret_id)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT decrypted_secret INTO v_value
    FROM vault.decrypted_secrets
    WHERE id = secret_id;

  RETURN v_value;
END $$;

CREATE OR REPLACE FUNCTION disconnect_garmin()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_id uuid;
  v_pass_id  uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT vault_secret_id_email, vault_secret_id_password
    INTO v_email_id, v_pass_id
    FROM garmin_credentials
    WHERE user_id = auth.uid();

  IF v_email_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id IN (v_email_id, v_pass_id);
  END IF;

  DELETE FROM garmin_credentials WHERE user_id = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION store_garmin_credentials(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION read_secret(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION disconnect_garmin()                  TO authenticated;
