import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PostForm } from "@/components/PostForm";
import { useIsAdmin } from "@/lib/useSession";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/admin/$id/edit")({
  component: EditPost,
  head: () => ({ meta: [{ title: "Edit post · Warm Notes" }] }),
});

function EditPost() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, adminLoading, navigate]);

  const postQ = useQuery({
    queryKey: ["post-edit", id],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!isAdmin || postQ.isLoading) return <p className="text-center py-20 text-muted-foreground">Loading…</p>;
  if (!postQ.data) return <p className="text-center py-20">Post not found.</p>;

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="font-serif text-4xl mb-8">Edit post</h1>
      <PostForm
        initial={{
          title: postQ.data.title,
          excerpt: postQ.data.excerpt ?? "",
          cover_image_url: postQ.data.cover_image_url ?? "",
          content: postQ.data.content,
        }}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          const { error } = await supabase
            .from("posts")
            .update({
              title: values.title,
              excerpt: values.excerpt || null,
              cover_image_url: values.cover_image_url || null,
              content: values.content,
            })
            .eq("id", id);
          if (error) return toast.error(error.message);
          toast.success("Saved");
          navigate({ to: "/posts/$slug", params: { slug: postQ.data.slug } });
        }}
      />
    </div>
  );
}
