CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update site settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default footer data
INSERT INTO public.site_settings (key, value) VALUES
('footer', '{
  "company_links": [
    {"label": "About Us", "url": "/about"},
    {"label": "Our Authors", "url": "/authors"},
    {"label": "Contact Us", "url": "/contact"},
    {"label": "Privacy Policy", "url": "/privacy"},
    {"label": "Terms and Conditions", "url": "/terms"}
  ],
  "social_links": [
    {"label": "Facebook", "url": "https://facebook.com", "icon": "facebook"},
    {"label": "Instagram", "url": "https://instagram.com", "icon": "instagram"},
    {"label": "X", "url": "https://x.com", "icon": "x"},
    {"label": "YouTube", "url": "https://youtube.com", "icon": "youtube"}
  ],
  "read_us": {
    "description": "Our applications for phones",
    "app_store_url": "",
    "play_store_url": "https://play.google.com"
  },
  "brands": [
    {"label": "SoshoBird", "url": "/"},
    {"label": "Our Network", "url": "#"}
  ]
}');
