import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/posts/$slug")({
  component: PostPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} · Warm Notes` },
    ],
  }),
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  content: string;
  created_at: string;
  author_id: string;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

function PostPage() {
  const { slug } = Route.useParams();
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");

  const postQ = useQuery({
    queryKey: ["post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as Post | null;
    },
  });

  const post = postQ.data;

  const commentsQ = useQuery({
    queryKey: ["comments", post?.id],
    enabled: !!post,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, profiles(display_name, avatar_url)")
        .eq("post_id", post!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Comment[];
    },
  });

  const likesQ = useQuery({
    queryKey: ["likes", post?.id, user?.id],
    enabled: !!post,
    queryFn: async () => {
      const [countRes, mineRes] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", post!.id),
        user
          ? supabase.from("likes").select("id").eq("post_id", post!.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
      ]);
      if (countRes.error) throw countRes.error;
      return {
        count: countRes.count ?? 0,
        liked: !!(mineRes.data as { id: string } | null),
      };
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user || !post) throw new Error("Sign in to like");
      if (likesQ.data?.liked) {
        const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["likes", post?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !post) throw new Error("Sign in to comment");
      const trimmed = commentText.trim();
      if (!trimmed) throw new Error("Comment can't be empty");
      if (trimmed.length > 1000) throw new Error("Comment too long");
      const { error } = await supabase
        .from("comments")
        .insert({ post_id: post.id, user_id: user.id, content: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["comments", post?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", post?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (postQ.isLoading) return <p className="text-center py-20 text-muted-foreground">Loading…</p>;
  if (!post)
    return (
      <div className="text-center py-20">
        <p className="font-serif text-2xl">Post not found</p>
        <Link to="/" className="text-primary mt-4 inline-block">← Back home</Link>
      </div>
    );

  return (
    <article className="max-w-2xl mx-auto px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← All posts</Link>

      <header className="mt-6 mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">
          {format(new Date(post.created_at), "MMMM d, yyyy")}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight mt-3">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
      </header>

      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt=""
          className="w-full aspect-[16/9] object-cover rounded-3xl border border-border mb-10"
        />
      )}

      <div className="prose-blog whitespace-pre-wrap text-foreground/90">
        {post.content}
      </div>

      {isAdmin && (
        <div className="flex gap-2 mt-8 pt-6 border-t border-border">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/admin/$id/edit" params={{ id: post.id }}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-destructive"
            onClick={() => {
              if (confirm("Delete this post?")) deletePost.mutate();
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete
          </Button>
        </div>
      )}

      {/* Reactions */}
      <div className="flex items-center justify-center gap-6 my-12 py-6 border-y border-border/60">
        <button
          onClick={() => {
            if (!user) return navigate({ to: "/auth" });
            toggleLike.mutate();
          }}
          className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Like this post"
        >
          <Heart
            className={`h-6 w-6 transition-all ${
              likesQ.data?.liked ? "fill-primary text-primary" : "group-hover:scale-110"
            }`}
          />
          <span className="text-sm font-medium">{likesQ.data?.count ?? 0}</span>
        </button>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MessageCircle className="h-6 w-6" />
          <span className="text-sm font-medium">{commentsQ.data?.length ?? 0}</span>
        </div>
      </div>

      {/* Comments */}
      <section className="mt-8">
        <h2 className="font-serif text-2xl mb-6">Notes back</h2>

        {user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addComment.mutate();
            }}
            className="mb-8"
          >
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave a warm note…"
              rows={3}
              maxLength={1000}
              className="rounded-2xl"
            />
            <div className="flex justify-end mt-2">
              <Button type="submit" disabled={addComment.isPending} className="rounded-full">
                Post note
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl bg-secondary/60 p-4 text-center mb-8">
            <Link to="/auth" className="text-primary font-medium">Sign in</Link>{" "}
            <span className="text-muted-foreground">to leave a comment.</span>
          </div>
        )}

        <div className="space-y-6">
          {commentsQ.data?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                  {(c.profiles?.display_name ?? "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="font-medium text-sm">{c.profiles?.display_name ?? "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), "MMM d, yyyy")}
                  </p>
                  {(user?.id === c.user_id || isAdmin) && (
                    <button
                      onClick={() => deleteComment.mutate(c.id)}
                      className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1 text-foreground/90 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          {commentsQ.data?.length === 0 && (
            <p className="text-center text-muted-foreground text-sm">Be the first to leave a note.</p>
          )}
        </div>
      </section>
    </article>
  );
}
