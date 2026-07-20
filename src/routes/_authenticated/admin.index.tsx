import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Eye, Pencil, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Admin Dashboard · Warm Notes" }] }),
});

type PostWithViews = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published: boolean;
  created_at: string;
  views: number;
};

function AdminDashboard() {
  const navigate = useNavigate();
  const { loading: sessionLoading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  const isLoading = sessionLoading || adminLoading;

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const postsQ = useQuery({
    queryKey: ["admin", "posts"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, slug, title, excerpt, published, created_at, views")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PostWithViews[];
    },
  });

  if (isLoading || !isAdmin) return <p className="text-center py-20 text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your posts and view analytics</p>
        </div>
        <Link to="/admin/new">
          <Button className="rounded-full gap-2">
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </Link>
      </div>

      {postsQ.isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse space-y-2">
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {postsQ.error && (
        <div className="text-center py-12 text-destructive text-sm">Failed to load posts.</div>
      )}

      {postsQ.data?.length === 0 && (
        <div className="text-center py-20">
          <p className="font-serif text-xl text-foreground mb-2">No posts yet</p>
          <p className="text-sm text-muted-foreground">Create your first post to get started.</p>
          <Link to="/admin/new" className="inline-block mt-4">
            <Button className="rounded-full">Write a post</Button>
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {postsQ.data?.map((post) => (
          <div
            key={post.id}
            className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-serif text-lg font-bold truncate">{post.title}</h2>
                {!post.published && (
                  <span className="text-[10px] uppercase tracking-widest text-destructive font-semibold bg-destructive/10 px-2 py-0.5 rounded-full">
                    Draft
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{format(new Date(post.created_at), "MMM d, yyyy")}</span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{post.views} {post.views === 1 ? "view" : "views"}</span>
                </span>
              </div>
              {post.excerpt && (
                <p className="text-sm text-muted-foreground/70 mt-1 line-clamp-1">{post.excerpt}</p>
              )}
            </div>
            <Link to="/admin/$id/edit" params={{ id: post.id }}>
              <Button variant="outline" size="sm" className="rounded-full shrink-0">
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

