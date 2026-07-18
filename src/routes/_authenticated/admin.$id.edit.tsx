import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PostForm } from "@/components/PostForm";
import { useIsAdmin, useSession } from "@/lib/useSession";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$id/edit")({
  component: EditPost,
  head: () => ({ meta: [{ title: "Edit post · Warm Notes" }] }),
});

function EditPost() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { loading: sessionLoading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  const isLoading = sessionLoading || adminLoading;

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const postQ = useQuery({
    queryKey: ["post-edit", id],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !isAdmin) return <p className="text-center py-20 text-muted-foreground">Loading…</p>;
  if (postQ.isLoading) return <p className="text-center py-20 text-muted-foreground">Loading…</p>;

  const post = postQ.data;
  if (!post) return <p className="text-center py-20">Post not found.</p>;

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="font-serif text-4xl mb-8">Edit post</h1>
      <PostForm
        initial={{
          title: post.title,
          excerpt: post.excerpt ?? "",
          cover_media_url: post.cover_image_url ?? "",
          content: post.content,
        }}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          const { error } = await supabase
            .from("posts")
            .update({
              title: values.title,
              excerpt: values.excerpt || null,
              cover_image_url: values.cover_media_url || null,
              content: values.content,
            })
            .eq("id", id);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Saved");
          navigate({ to: "/posts/$slug", params: { slug: post.slug } });
        }}
      />
    </div>
  );
}
