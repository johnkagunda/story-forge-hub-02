import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/blogs/$slug/view")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { slug } = params;

        try {
          // Parse the request body
          const body = await request.json() as { visitorId?: string };
          const visitorId = body.visitorId;

          // Validate visitorId — ignore invalid or empty
          if (!visitorId || typeof visitorId !== "string" || visitorId.trim().length === 0) {
            return Response.json({ success: true });
          }

          // Dynamic import for server-only admin client
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Get the post by slug
          const { data: post, error: postError } = await supabaseAdmin
            .from("posts")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();

          if (postError || !post) {
            // Post not found — return success to not leak existence of slugs
            return Response.json({ success: true });
          }

          // Use the database function to atomically handle the view
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: viewError } = await (supabaseAdmin as any).rpc("increment_post_views", {
            post_id: post.id,
            visitor_id: visitorId.trim(),
          });

          if (viewError) {
            console.error("Failed to record blog view:", viewError);
          }

          return Response.json({ success: true });
        } catch (err) {
          // Fail silently — don't break the blog experience
          console.error("Blog view tracking error:", err);
          return Response.json({ success: true });
        }
      },
    },
  },
});

