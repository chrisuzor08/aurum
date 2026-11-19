-- AURUM security + search migration.
-- Apply AFTER `npx drizzle-kit push` (or the generated drizzle/ migrations).
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- Helper: the authenticated account for the current transaction ----------
-- The Next.js server sets `app.current_user_id` (per transaction) from the verified session.
CREATE OR REPLACE FUNCTION aurum_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION aurum_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = aurum_current_user_id() AND a.role = 'admin'
  )
$$;

-- ---------- Enable RLS on EVERY table ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Drop + recreate policies so the file can be re-applied.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Public catalogue: readable by anyone, writable only by administrators.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artists','albums','songs','shorts','chart_snapshots'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', t || '_public_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (aurum_is_admin()) WITH CHECK (aurum_is_admin())', t || '_admin_write', t);
  END LOOP;
END $$;

-- Accounts & sessions & payments: owner-only, never client-writable for role/billing.
CREATE POLICY accounts_self_read ON public.accounts FOR SELECT USING (id = aurum_current_user_id() OR aurum_is_admin());
CREATE POLICY sessions_self ON public.sessions FOR SELECT USING (user_id = aurum_current_user_id());
CREATE POLICY password_resets_self ON public.password_resets FOR SELECT USING (user_id = aurum_current_user_id());
CREATE POLICY payment_events_admin ON public.payment_events FOR SELECT USING (aurum_is_admin());

-- Profiles: public read of basic profile, owner update of non-privileged columns only
-- (is_premium / premium_expires_at are protected by the trigger below).
CREATE POLICY profiles_public_read ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE
  USING (id = aurum_current_user_id()) WITH CHECK (id = aurum_current_user_id());
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL USING (aurum_is_admin()) WITH CHECK (aurum_is_admin());

-- Owner-only tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['playlists','likes','follows','album_saves','downloads','play_events','skip_events','search_history','notifications','preferences','subscriptions','short_likes'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (user_id = aurum_current_user_id() OR aurum_is_admin()) WITH CHECK (user_id = aurum_current_user_id() OR aurum_is_admin())', t || '_owner', t);
  END LOOP;
END $$;

-- Subscriptions: owners may read but never insert/update (backend/webhook only).
DROP POLICY IF EXISTS subscriptions_owner ON public.subscriptions;
CREATE POLICY subscriptions_owner_read ON public.subscriptions FOR SELECT USING (user_id = aurum_current_user_id() OR aurum_is_admin());

-- Public playlists are readable by anyone; private ones only by owner.
CREATE POLICY playlists_public_read ON public.playlists FOR SELECT USING (is_public OR user_id = aurum_current_user_id() OR aurum_is_admin());
DROP POLICY IF EXISTS playlists_owner ON public.playlists;
CREATE POLICY playlists_owner_write ON public.playlists FOR ALL USING (user_id = aurum_current_user_id() OR aurum_is_admin()) WITH CHECK (user_id = aurum_current_user_id() OR aurum_is_admin());

CREATE POLICY playlist_songs_read ON public.playlist_songs FOR SELECT USING (
  EXISTS (SELECT 1 FROM playlists p WHERE p.id = playlist_id AND (p.is_public OR p.user_id = aurum_current_user_id()))
);
CREATE POLICY playlist_songs_owner_write ON public.playlist_songs FOR ALL USING (
  EXISTS (SELECT 1 FROM playlists p WHERE p.id = playlist_id AND (p.user_id = aurum_current_user_id() OR aurum_is_admin()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM playlists p WHERE p.id = playlist_id AND (p.user_id = aurum_current_user_id() OR aurum_is_admin()))
);

-- Comments: public read, author-only modify/delete.
CREATE POLICY comments_public_read ON public.comments FOR SELECT USING (true);
CREATE POLICY comments_author_write ON public.comments FOR ALL USING (user_id = aurum_current_user_id() OR aurum_is_admin())
  WITH CHECK (user_id = aurum_current_user_id() OR aurum_is_admin());

-- Premium gating (also enforced in code via src/lib/entitlements.ts).
CREATE OR REPLACE FUNCTION aurum_protect_profile_privileges() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT aurum_is_admin() AND current_setting('app.service_role', true) IS DISTINCT FROM 'on' THEN
    NEW.is_premium := OLD.is_premium;
    NEW.premium_expires_at := OLD.premium_expires_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_protect_privileges ON public.profiles;
CREATE TRIGGER profiles_protect_privileges BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION aurum_protect_profile_privileges();

-- ---------- Indexes for search (ILIKE / trigram) ----------
CREATE INDEX IF NOT EXISTS songs_title_trgm ON public.songs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS songs_lyrics_trgm ON public.songs USING gin (lyrics_plain gin_trgm_ops);
CREATE INDEX IF NOT EXISTS artists_name_trgm ON public.artists USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS albums_title_trgm ON public.albums USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS playlists_name_trgm ON public.playlists USING gin (name gin_trgm_ops);

-- ---------- Atomic helpers ----------
-- Record a play and bump the song counter in one statement-level transaction.
CREATE OR REPLACE FUNCTION aurum_record_play(p_user uuid, p_song uuid, p_seconds int)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO play_events (user_id, song_id, seconds_listened) VALUES (p_user, p_song, p_seconds) RETURNING id INTO v_id;
  UPDATE songs SET play_count = play_count + 1 WHERE id = p_song;
  RETURN v_id;
END $$;

-- Toggle a short like and keep likes_count consistent.
CREATE OR REPLACE FUNCTION aurum_toggle_short_like(p_user uuid, p_short uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_inserted int;
BEGIN
  INSERT INTO short_likes (user_id, short_id) VALUES (p_user, p_short) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 1 THEN
    UPDATE shorts SET likes_count = likes_count + 1 WHERE id = p_short;
    RETURN true;
  END IF;
  DELETE FROM short_likes WHERE user_id = p_user AND short_id = p_short;
  UPDATE shorts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_short;
  RETURN false;
END $$;
