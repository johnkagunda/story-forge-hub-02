import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { useBlogViewTracker } from "@/lib/useBlogViewTracker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUp, ArrowDown, MessageCircle, Pencil, Trash2, CornerDownRight, Bookmark, Share2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/posts/$slug")({
  component: PostPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.slug.replace(/-/g, " ")} · SoshoBird` }],
  }),
});

type Post = {
  id: string; slug: string; title: string; excerpt: string | null;
  cover_image_url: string | null; content: string; created_at: string; author_id: string;
};

type CommentRow = {
  id: string; content: string; created_at: string; user_id: string; parent_id: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Reply box ───────────────────────────────────────────────────────────────
function ReplyBox({ postId, parentId, onDone }: { postId: string; parentId: string; onDone: () => void }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) { navigate({ to: "/auth" }); return; }
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Reply can't be empty");
      const { error } = await db.from("comments").insert({
        post_id: postId, user_id: user.id, content: trimmed, parent_id: parentId,
      });
      if (error?.message?.includes("parent_id")) {
        const { error: e2 } = await db.from("comments").insert({ post_id: postId, user_id: user.id, content: trimmed });
        if (e2) throw e2;
        return;
      }
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["comments", postId] }); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex gap-2 items-start">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a reply…"
        rows={2}
        maxLength={1000}
        className="rounded-xl bg-card border-border text-sm flex-1 resize-none"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit.mutate(); }}
      />
      <Button size="sm" className="rounded-full px-4 h-8 text-xs shrink-0" onClick={() => submit.mutate()} disabled={submit.isPending || !text.trim()}>
        Post
      </Button>
    </div>
  );
}

// ─── Single comment + its replies ────────────────────────────────────────────
function CommentItem({
  comment, replies, postId, user, isAdmin, onDelete,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  postId: string;
  user: { id: string } | null;
  isAdmin: boolean | undefined;
  onDelete: (id: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const name = comment.profiles?.display_name ?? "Anonymous";
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div className="py-4 border-b border-border/50 last:border-0">
      {/* ── Top-level comment ── */}
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={comment.profiles?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-muted text-sm font-bold text-foreground">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm">{name}</span>
            <span className="text-[11px] text-muted-foreground">
              · {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{comment.content}</p>

          {/* Action row */}
          <div className="flex items-center gap-3 mt-2">
            {user && (
              <button
                onClick={() => setShowReply((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <CornerDownRight className="h-3 w-3" />
                {showReply ? "Cancel" : "Reply"}
                {replies.length > 0 && !showReply && (
                  <span className="ml-0.5 text-muted-foreground/60">· {replies.length}</span>
                )}
              </button>
            )}
            {(user?.id === comment.user_id || isAdmin) && (
              <button onClick={() => onDelete(comment.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Replies + reply box indented ── */}
      {(replies.length > 0 || showReply) && (
        <div className="ml-12 mt-3 pl-3 border-l-2 border-primary/20 space-y-4">
          {replies.map((reply) => {
            const rName = reply.profiles?.display_name ?? "Anonymous";
            const rInitial = rName[0]?.toUpperCase() ?? "?";
            return (
              <div key={reply.id} className="flex gap-3">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={reply.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-[10px] font-bold text-primary">{rInitial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-xs">{rName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      · {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                  {(user?.id === reply.user_id || isAdmin) && (
                    <button onClick={() => onDelete(reply.id)} className="mt-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {showReply && (
            <ReplyBox postId={postId} parentId={comment.id} onDone={() => setShowReply(false)} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Post page ────────────────────────────────────────────────────────────────
function PostPage() {
  const { slug } = Route.useParams();
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");

  useBlogViewTracker(slug);

  const postQ = useQuery({
    queryKey: ["post", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as Post | null;
    },
  });

  const post = postQ.data;

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

  const commentsQ = useQuery({
    queryKey: ["comments", post?.id],
    enabled: !!post,
    queryFn: async () => {
      const { data, error } = await db
        .from("comments")
        .select("id, content, created_at, user_id")
        .eq("post_id", post!.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data?.length) return [] as CommentRow[];

      // Fetch profiles separately to avoid FK hint issues
      const userIds = [...new Set((data as { user_id: string }[]).map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

      return data.map((c: { id: string; content: string; created_at: string; user_id: string }) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_id: c.user_id,
        parent_id: null,
        profiles: profileMap[c.user_id] ?? null,
      })) as CommentRow[];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !post) throw new Error("Sign in to comment");
      const trimmed = commentText.trim();
      if (!trimmed) throw new Error("Comment can't be empty");
      const { error } = await db.from("comments").insert({ post_id: post.id, user_id: user.id, content: trimmed });
      if (error) throw error;
    },
    onSuccess: () => { setCommentText(""); qc.invalidateQueries({ queryKey: ["comments", post?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("comments").delete().eq("id", id);
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

  const bookmarkQ = useQuery({
    queryKey: ["bookmark", post?.id, user?.id],
    enabled: !!post && !!user,
    queryFn: async () => {
      const { data } = await db
        .from("bookmarks")
        .select("id")
        .eq("post_id", post!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!user || !post) { navigate({ to: "/auth" }); return; }
      if (bookmarkQ.data) {
        const { error } = await db.from("bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("bookmarks").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmark", post?.id, user?.id] });
      qc.invalidateQueries({ queryKey: ["bookmarks", user?.id] });
      toast.success(bookmarkQ.data ? "Bookmark removed" : "Bookmarked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: post?.title ?? "", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
    }
  };

  if (postQ.isLoading) return <p className="text-center py-20 text-muted-foreground">Loading…</p>;
  if (!post) return (
    <div className="text-center py-20">
      <p className="font-serif text-2xl">Post not found</p>
      <Link to="/" className="text-primary mt-4 inline-block">← Back home</Link>
    </div>
  );

  const isVideo = post.cover_image_url?.match(/\.(mp4|webm|ogg)(\?|$)/i);
  const allComments = commentsQ.data ?? [];
  const topLevel = allComments.filter((c) => !c.parent_id);
  const replies = allComments.filter((c) => !!c.parent_id);
  const repliesFor = (id: string) => replies.filter((r) => r.parent_id === id);
  const totalCount = allComments.length;

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
          {isVideo
            ? <video src={post.cover_image_url} controls className="w-full" />
            : <img src={post.cover_image_url} alt="" className="w-full object-cover" />
          }
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
          <span className="text-sm">{totalCount}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleBookmark.mutate()}
            disabled={toggleBookmark.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors
              ${bookmarkQ.data ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
            aria-label={bookmarkQ.data ? "Remove bookmark" : "Bookmark"}
          >
            <Bookmark className={`h-4 w-4 ${bookmarkQ.data ? "fill-primary" : ""}`} />
          </button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" className="rounded-full"
                onClick={() => navigate({ to: "/admin/$id/edit", params: { id: post.id } })}>
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => { if (confirm("Delete this post?")) deletePost.mutate(); }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Comments section */}
      <section className="mt-2">
        <h2 className="font-serif text-xl font-bold mb-5">
          {totalCount > 0 ? `${totalCount} Comment${totalCount !== 1 ? "s" : ""}` : "Comments"}
        </h2>

        {/* New comment box */}
        {user ? (
          <form onSubmit={(e) => { e.preventDefault(); addComment.mutate(); }} className="mb-8 flex gap-3">
            <Avatar className="h-8 w-8 shrink-0 mt-1">
              <AvatarFallback className="bg-primary text-white text-xs font-bold">
                {user.email?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                rows={3}
                maxLength={1000}
                className="rounded-2xl bg-card border-border text-sm resize-none"
              />
              <div className="flex justify-end mt-2">
                <Button type="submit" disabled={addComment.isPending || !commentText.trim()} className="rounded-full px-5 h-8 text-sm">
                  Post
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="rounded-xl bg-card border border-border p-4 text-center mb-7 text-sm">
            <Link to="/auth" className="text-primary font-medium">Sign in</Link>
            <span className="text-muted-foreground"> to join the conversation.</span>
          </div>
        )}

        {/* Thread list */}
        <div className="divide-y divide-border/30">
          {topLevel.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesFor(c.id)}
              postId={post.id}
              user={user}
              isAdmin={isAdmin}
              onDelete={(id) => deleteComment.mutate(id)}
            />
          ))}
          {commentsQ.error && (
            <p className="text-center text-destructive text-sm py-4">
              {(commentsQ.error as Error).message}
            </p>
          )}
          {topLevel.length === 0 && !commentsQ.isLoading && !commentsQ.error && (
            <p className="text-center text-muted-foreground text-sm py-6">
              No comments yet. Be the first to share your thoughts.
            </p>
          )}
        </div>
      </section>
    </article>
  );
}
