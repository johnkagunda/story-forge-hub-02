import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Warm Notes — A personal blog" },
      { name: "description", content: "Personal essays, notes, and stories from a warm little corner of the internet." },
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

function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["posts", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, slug, title, excerpt, cover_image_url, created_at, author_id")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PostRow[];
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <section className="mb-16 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-primary mb-4">A personal blog</p>
        <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] text-foreground">
          Small notes, honestly told.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
          Essays, half-thoughts, and stories from the everyday. Read, react, and leave a note back.
        </p>
      </section>

      {isLoading && <p className="text-center text-muted-foreground">Loading…</p>}
      {error && <p className="text-center text-destructive">Failed to load posts.</p>}
      {data && data.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-3xl">
          <p className="font-serif text-2xl text-foreground">No posts yet</p>
          <p className="mt-2 text-muted-foreground">The first story is coming soon.</p>
        </div>
      )}

      <div className="space-y-10">
        {data?.map((post) => (
          <Link
            key={post.id}
            to="/posts/$slug"
            params={{ slug: post.slug }}
            className="block group"
          >
            <article className="grid md:grid-cols-[1fr_auto] gap-6 items-start pb-10 border-b border-border/60 last:border-b-0">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {format(new Date(post.created_at), "MMMM d, yyyy")}
                </p>
                <h2 className="font-serif text-3xl leading-tight text-foreground group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="mt-3 text-muted-foreground leading-relaxed">{post.excerpt}</p>
                )}
                <p className="mt-4 text-sm text-primary font-medium">Read more →</p>
              </div>
              {post.cover_image_url && (
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="hidden md:block w-40 h-40 object-cover rounded-2xl border border-border"
                />
              )}
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
