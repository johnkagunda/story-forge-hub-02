import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PostForm } from "@/components/PostForm";
import { useIsAdmin, useSession } from "@/lib/useSession";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/admin/new")({
  component: NewPost,
  head: () => ({ meta: [{ title: "New post · Warm Notes" }] }),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function NewPost() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: isAdmin, isLoading } = useIsAdmin();

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  if (!isAdmin) return <p className="text-center py-20 text-muted-foreground">Checking…</p>;

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="font-serif text-4xl mb-8">Write a new post</h1>
      <PostForm
        onSubmit={async (values) => {
          if (!user) return;
          const slug = `${slugify(values.title)}-${Math.random().toString(36).slice(2, 6)}`;
          const { data, error } = await supabase
            .from("posts")
            .insert({
              author_id: user.id,
              title: values.title,
              slug,
              excerpt: values.excerpt || null,
              cover_image_url: values.cover_image_url || null,
              content: values.content,
              published: true,
            })
            .select("slug")
            .single();
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Published");
          navigate({ to: "/posts/$slug", params: { slug: data.slug } });
        }}
      />
    </div>
  );
}
