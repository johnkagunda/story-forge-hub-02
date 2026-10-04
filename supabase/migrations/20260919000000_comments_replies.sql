-- Add parent_id to support one-level comment replies
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS comments_post_id_created_at_idx ON public.comments(post_id, created_at);
