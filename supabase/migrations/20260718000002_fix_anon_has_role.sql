-- Allow anon to execute has_role so the posts RLS policy can evaluate it.
-- has_role is SECURITY DEFINER so it can't escalate privileges — safe to expose.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
