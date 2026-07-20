import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, ArrowDown, Share2, Bookmark, Search, X } from "lucide-react";
import { useSession } from "@/lib/useSession";
import { toast } from "sonner";
import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: Home,
  head: () => ({
    meta: [
      { title: "Warm Notes" },
      { name: "description", content: "Personal essays, notes, and stories." },
    ],
  }),
});

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
  author_id: string;
};

type VoteState = {
  upvotes: number;
  downvotes: number;
  myVote: "up" | "down" | null;
};

function useVotes(postId: string) {
  const { user } = useSession();

  return useQuery<VoteState>({
    queryKey: ["votes", postId, user?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [countRes, myRes] = await Promise.all([
        db.from("votes").select("vote").eq("post_id", postId),
        user
          ? db.from("votes").select("vote").eq("post_id", postId).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (countRes.error) throw countRes.error;

      const rows: { vote: string }[] = countRes.data ?? [];
      const upvotes = rows.filter((r) => r.vote === "up").length;
      const downvotes = rows.filter((r) => r.vote === "down").length;

      return {
        upvotes,
        downvotes,
        myVote: (myRes.data as { vote: "up" | "down" } | null)?.vote ?? null,
      };
    },
  });
}

function VoteButtons({ postId }: { postId: string }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useVotes(postId);

  const vote = useMutation({
    mutationFn: async (direction: "up" | "down") => {
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const current = data?.myVote ?? null;

      if (current === direction) {
        const { error } = await db.from("votes").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      } else if (current === null) {
        const { error } = await db.from("votes").insert({ post_id: postId, user_id: user.id, vote: direction });
        if (error) throw error;
      } else {
        const { error } = await db.from("votes").update({ vote: direction }).eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["votes", postId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const upvotes = data?.upvotes ?? 0;
  const downvotes = data?.downvotes ?? 0;
  const myVote = data?.myVote ?? null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => { e.preventDefault(); vote.mutate("up"); }}
        disabled={vote.isPending}
        aria-label="Upvote"
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors text-sm font-semibold
          ${myVote === "up"
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:text-primary hover:bg-primary/10"
          }`}
      >
        <ArrowUp className="h-4 w-4" />
        <span>{upvotes}</span>
      </button>

      <button
        onClick={(e) => { e.preventDefault(); vote.mutate("down"); }}
        disabled={vote.isPending}
        aria-label="Downvote"
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors text-sm
          ${myVote === "down"
            ? "bg-red-500/20 text-red-400"
            : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          }`}
      >
        <ArrowDown className="h-4 w-4" />
        <span>{downvotes}</span>
      </button>
    </div>
  );
}

function PostCard({ post }: { post: PostRow }) {
  const isVideo = post.cover_image_url?.match(/\.(mp4|webm|ogg)(\?|$)/i);

  return (
    <article className="post-card border-b border-border">
      {/* Cover media — clicking navigates */}
      <Link to="/posts/$slug" params={{ slug: post.slug }}>
        {post.cover_image_url && (
          <div className="post-card-media">
            {isVideo ? (
              <video src={post.cover_image_url} muted loop playsInline />
            ) : (
              <img src={post.cover_image_url} alt={post.title} loading="lazy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="category-pill">Story</span>
            </div>
          </div>
        )}

        {/* Text content */}
        <div className="px-4 pt-3">
          {/* Source row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                W
              </div>
              <span className="text-xs font-semibold text-foreground">Warm Notes</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })} ago
              </span>
            </div>
            <button
              onClick={(e) => e.preventDefault()}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="More"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
          </div>

          <h2 className="font-serif text-[1.15rem] font-bold leading-snug text-foreground mb-1.5 line-clamp-3">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-1">
              {post.excerpt}
            </p>
          )}

          <p className="text-xs text-primary font-medium mt-1 mb-3">Read full story</p>
        </div>
      </Link>

      {/* Action row — outside the Link to avoid nested interactive elements */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <VoteButtons postId={post.id} />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              navigator.share?.({ title: post.title, url: window.location.origin + `/posts/${post.slug}` })
                .catch(() => {});
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Bookmark"
          >
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function SearchBar() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [localValue, setLocalValue] = useState(q ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync URL search param to local state when navigated externally
  useEffect(() => {
    setLocalValue(q ?? "");
  }, [q]);

  // Debounce: update URL search param 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = localValue.trim();
      if (trimmed) {
        navigate({ to: "/", search: { q: trimmed }, replace: true });
      } else if (q !== undefined) {
        navigate({ to: "/", search: { q: undefined }, replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, navigate, q]);

  // Auto-focus when navigated with ?q=
  useEffect(() => {
    if (q && inputRef.current) {
      inputRef.current.focus();
    }
  }, [q]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    navigate({ to: "/", search: { q: undefined }, replace: true });
    inputRef.current?.focus();
  }, [navigate]);

  return (
    <div className="relative px-4 pt-4 pb-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder="Search stories..."
          className="pl-9 pr-9 h-10 rounded-xl bg-card border-border text-sm"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Home() {
  const { q } = Route.useSearch();
  const { data, isLoading, error } = useQuery({
    queryKey: ["posts", "list", q],
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select("id, slug, title, excerpt, cover_image_url, created_at, author_id")
        .eq("published", true);

      if (q) {
        query = query.or(
          `title.ilike.%${q}%,excerpt.ilike.%${q}%,content.ilike.%${q}%`
        );
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as PostRow[];
    },
  });

  return (
    <div className="max-w-lg mx-auto">
      <SearchBar />

      {isLoading && (
        <div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-border animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-5 bg-muted rounded w-full" />
                <div className="h-5 bg-muted rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-20 text-destructive text-sm">Failed to load posts.</div>
      )}

      {data?.length === 0 && !isLoading && (
        <div className="text-center py-24 px-6">
          <div className="text-4xl mb-4">{q ? "🔍" : "✍️"}</div>
          <p className="font-serif text-xl text-foreground">
            {q ? "No matching stories" : "No posts yet"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {q
              ? `We couldn't find anything for "${q}". Try a different keyword.`
              : "The first story is coming soon."}
          </p>
        </div>
      )}

      {q && data && data.length > 0 && (
        <div className="px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Found {data.length} {data.length === 1 ? "story" : "stories"} for "{q}"
          </p>
        </div>
      )}

      <div>
        {data?.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
