import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUp, ArrowDown, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/posts/$slug")({
  component: PostPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.slug.replace(/-/g, " ")} · Warm Notes` }],
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
      const { data, error } = await supabase.from("posts").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as Post | null;
    },
  });

  const post = postQ.data;

  // Votes
  const votesQ = useQuery({
    queryKey: ["votes", post?.id, user?.id],
    enabled: !!post,
    queryFn: async () => {
      const [countRes, myRes] = await Promise.all([
        db.from("votes").select("vote").eq("post_id", post!.id),
        user
          ? db.from("votes").select("vote").eq("post_id", post!.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (countRes.error) throw countRes.error;
      const rows: { vote: string }[] = countRes.data ?? [];
      return {
        upvotes: rows.filter((r) => r.vote === "up").length,
        downvotes: rows.filter((r) => r.vote === "down").length,
        myVote: (myRes.data as { vote: "up" | "down" } | null)?.vote ?? null,
      };
    },
  });

  const castVote = useMutation({
    mutationFn: async (direction: "up" | "down") => {
      if (!user || !post) { navigate({ to: "/auth" }); return; }
      const current = votesQ.data?.myVote ?? null;
      if (current === direction) {
        const { error } = await db.from("votes").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      } else if (!current) {
        const { error } = await db.from("votes").insert({ post_id: post.id, user_id: user.id, vote: direction });
        if (error) throw error;
      } else {
        const { error } = await db.from("votes").update({ vote: direction }).eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["votes", post?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Comments
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

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !post) throw new Error("Sign in to comment");
      const trimmed = commentText.trim();
      if (!trimmed) throw new Error("Comment can't be empty");
      if (trimmed.length > 1000) throw new Error("Comment too long");
      const { error } = await supabase.from("comments").insert({ post_id: post.id, user_id: user.id, content: trimmed });
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
    onSuccess: () => { toast.success("Post deleted"); navigate({ to: "/" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (postQ.isLoading) return <p className="text-center py-20 text-muted-foreground">Loading…</p>;
  if (!post) return (
    <div className="text-center py-20">
      <p className="font-serif text-2xl">Post not found</p>
      <Link to="/" className="text-primary mt-4 inline-block">← Back home</Link>
    </div>
  );

  const isVideo = post.cover_image_url?.match(/\.(mp4|webm|ogg)(\?|$)/i);

  return (
    <article className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← All posts</Link>

      <header className="mt-6 mb-6">
        <p className="text-xs uppercase tracking-widest text-primary mb-2">
          {format(new Date(post.created_at), "MMMM d, yyyy")}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>
        {post.excerpt && <p className="mt-3 text-muted-foreground leading-relaxed">{post.excerpt}</p>}
      </header>

      {post.cover_image_url && (
        <div className="w-full rounded-2xl overflow-hidden border border-border mb-8">
          {isVideo ? (
            <video src={post.cover_image_url} controls className="w-full" />
          ) : (
            <img src={post.cover_image_url} alt="" className="w-full object-cover" />
          )}
        </div>
      )}

      <div className="prose-blog whitespace-pre-wrap">{post.content}</div>

      {/* Vote bar */}
      <div className="flex items-center gap-3 my-8 py-5 border-y border-border">
        <button
          onClick={() => castVote.mutate("up")}
          disabled={castVote.isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors
            ${votesQ.data?.myVote === "up" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
        >
          <ArrowUp className="h-4 w-4" />
          <span>{votesQ.data?.upvotes ?? 0}</span>
        </button>
        <button
          onClick={() => castVote.mutate("down")}
          disabled={castVote.isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors
            ${votesQ.data?.myVote === "down" ? "bg-red-500/20 text-red-400" : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"}`}
        >
          <ArrowDown className="h-4 w-4" />
          <span>{votesQ.data?.downvotes ?? 0}</span>
        </button>
        <div className="flex items-center gap-1.5 text-muted-foreground ml-2">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{commentsQ.data?.length ?? 0}</span>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => navigate({ to: "/admin/$id/edit", params: { id: post.id } })}
            >
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => { if (confirm("Delete this post?")) deletePost.mutate(); }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Comments */}
      <section className="mt-6">
        <h2 className="font-serif text-xl font-bold mb-5">Comments</h2>

        {user ? (
          <form onSubmit={(e) => { e.preventDefault(); addComment.mutate(); }} className="mb-7">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave a comment…"
              rows={3}
              maxLength={1000}
              className="rounded-xl bg-card border-border"
            />
            <div className="flex justify-end mt-2">
              <Button type="submit" disabled={addComment.isPending} className="rounded-full">
                Post
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-xl bg-card border border-border p-4 text-center mb-7">
            <Link to="/auth" className="text-primary font-medium">Sign in</Link>
            <span className="text-muted-foreground"> to leave a comment.</span>
          </div>
        )}

        <div className="space-y-5">
          {commentsQ.data?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-secondary text-xs font-bold">
                  {(c.profiles?.display_name ?? "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{c.profiles?.display_name ?? "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</p>
                  {(user?.id === c.user_id || isAdmin) && (
                    <button onClick={() => deleteComment.mutate(c.id)} className="ml-auto text-xs text-muted-foreground hover:text-destructive">
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          {commentsQ.data?.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">No comments yet.</p>
          )}
        </div>
      </section>
    </article>
  );
}
