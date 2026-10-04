import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Eye, Sparkles } from "lucide-react";

export const Route = createFileRoute("/explore")({
  ssr: false,
  component: Explore,
  head: () => ({
    meta: [
      { title: "Explore · SoshoBird" },
      { name: "description", content: "Trending and new stories on SoshoBird." },
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
  views: number;
};

function PostCard({ post, rank, isTrending }: { post: PostRow; rank: number; isTrending: boolean }) {
  const isVideo = post.cover_image_url?.match(/\.(mp4|webm|ogg)(\?|$)/i);

  return (
    <article className="post-card border-b border-border">
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
              {isTrending ? (
                <span className="text-white font-serif text-2xl font-bold opacity-80">#{rank}</span>
              ) : (
                <span className="category-pill">New</span>
              )}
            </div>
          </div>
        )}

        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                W
              </div>
              <span className="text-xs font-semibold text-foreground">SoshoBird</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })} ago
              </span>
            </div>
            {isTrending ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                <span>{post.views.toLocaleString()} reads</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Fresh</span>
              </div>
            )}
          </div>

          <h2 className="font-serif text-[1.15rem] font-bold leading-snug text-foreground mb-1.5 line-clamp-3">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-1">
              {post.excerpt}
            </p>
          )}

          <p className="text-xs text-primary font-medium mt-1 mb-4">Read full story</p>
        </div>
      </Link>
    </article>
  );
}

function Explore() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["posts", "explore"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, slug, title, excerpt, cover_image_url, created_at, author_id, post_views(count)")
        .eq("published", true)
        .limit(50);
      if (error) throw error;

      const rows = (data ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        cover_image_url: p.cover_image_url,
        created_at: p.created_at,
        author_id: p.author_id,
        views: Array.isArray(p.post_views)
          ? (p.post_views[0] as { count: number } | undefined)?.count ?? 0
          : 0,
      }));

      // If any post has views, sort by views desc (trending)
      // Otherwise sort by newest (not yet trending)
      const hasViews = rows.some((r) => r.views > 0);
      rows.sort(hasViews
        ? (a, b) => b.views - a.views
        : (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { posts: rows as PostRow[], isTrending: hasViews };
    },
  });

  const isTrending = data?.isTrending ?? false;

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-5 pb-3">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          {isTrending ? "Trending" : "Explore"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isTrending ? "Stories people are reading most" : "Latest stories to discover"}
        </p>
      </div>

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

      {!isLoading && !error && data?.posts.length === 0 && (
        <div className="text-center py-24 px-6">
          <div className="text-4xl mb-4">✍️</div>
          <p className="font-serif text-xl text-foreground">No stories yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Check back soon.</p>
        </div>
      )}

      <div>
        {data?.posts.map((post, i) => (
          <PostCard key={post.id} post={post} rank={i + 1} isTrending={isTrending} />
        ))}
      </div>
    </div>
  );
}
