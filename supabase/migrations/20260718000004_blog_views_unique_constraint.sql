-- Add views counter to posts table for fast retrieval
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- Add unique constraint on (post_id, session_id) to prevent duplicate views
-- First clean up any existing duplicates (keep the earliest record per visitor per post)
DELETE FROM public.post_views a
USING public.post_views b
WHERE a.id < b.id
  AND a.post_id = b.post_id
  AND a.session_id = b.session_id;

-- Now add the unique constraint
ALTER TABLE public.post_views ADD CONSTRAINT post_views_post_id_session_id_key UNIQUE (post_id, session_id);

-- Create a composite index for efficient lookups
CREATE INDEX IF NOT EXISTS post_views_post_id_session_id_idx ON public.post_views(post_id, session_id);

-- Create or replace function to increment post views (used by the API)
CREATE OR REPLACE FUNCTION public.increment_post_views(post_id uuid, visitor_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_row_id uuid;
BEGIN
  -- Try to insert the view record; if duplicate, catch the unique violation
  BEGIN
    INSERT INTO public.post_views (post_id, session_id)
    VALUES (post_id, visitor_id)
    RETURNING id INTO existing_row_id;

    -- Successfully inserted new record → increment the counter
    UPDATE public.posts SET views = views + 1 WHERE id = post_id;
    RETURN true;
  EXCEPTION
    WHEN unique_violation THEN
      -- Visitor already viewed this post → do nothing
      RETURN false;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_post_views(uuid, text) FROM PUBLIC, anon, authenticated;

-- Grant execute to service_role only
GRANT ALL ON FUNCTION public.increment_post_views(uuid, text) TO service_role;

