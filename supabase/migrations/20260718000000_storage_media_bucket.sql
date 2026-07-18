-- Create media storage bucket for post images/videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  104857600, -- 100MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','video/mp4','video/webm','video/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read media files (bucket is public)
CREATE POLICY "Media files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Only admins can upload
CREATE POLICY "Admins can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'media' AND
  public.has_role(auth.uid(), 'admin')
);

-- Only admins can delete
CREATE POLICY "Admins can delete media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'media' AND
  public.has_role(auth.uid(), 'admin')
);
