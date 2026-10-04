import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const authHeader = request.headers.get("Authorization");
          if (!authHeader) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const token = authHeader.replace("Bearer ", "");
          const {
            data: { user },
            error: authError,
          } = await supabaseAdmin.auth.getUser(token);
          if (authError || !user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const { data: role } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (!role) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          const {
            data: { users },
            error,
          } = await supabaseAdmin.auth.admin.listUsers();
          if (error) throw error;

          const result = users.map((u) => ({
            id: u.id,
            email: u.email ?? null,
            created_at: u.created_at,
          }));

          return Response.json({ users: result });
        } catch (err) {
          console.error("Failed to list users:", err);
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
