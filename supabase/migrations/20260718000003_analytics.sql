-- Post views: one row per visit (anonymous ok)
CREATE TABLE public.post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,                    -- fingerprint for anon dedup
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.post_views TO anon;
GRANT SELECT, INSERT ON public.post_views TO authenticated;
GRANT ALL ON public.post_views TO service_role;

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert a view"
  ON public.post_views FOR INSERT WITH CHECK (true);

CREATE POLICY "Views readable by service role only via admin"
  ON public.post_views FOR SELECT USING (true);

CREATE INDEX post_views_post_id_idx ON public.post_views(post_id);
CREATE INDEX post_views_created_at_idx ON public.post_views(created_at);
