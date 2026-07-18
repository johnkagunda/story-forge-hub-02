import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

export type PostFormValues = {
  title: string;
  excerpt: string;
  cover_media_url: string;
  content: string;
};

export function PostForm({
  initial,
  onSubmit,
  submitLabel = "Publish",
}: {
  initial?: PostFormValues;
  onSubmit: (values: PostFormValues) => Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<PostFormValues>(
    initial ?? { title: "", excerpt: "", cover_media_url: "", content: "" },
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: "image" | "video" } | null>(
    initial?.cover_media_url
      ? {
          url: initial.cover_media_url,
          type: initial.cover_media_url.match(/\.(mp4|webm|ogg)$/i) ? "video" : "image",
        }
      : null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) {
      toast.error("Only images and videos are supported");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) throw error;

      const { data } = supabase.storage.from("media").getPublicUrl(path);
      setValues((v) => ({ ...v, cover_media_url: data.publicUrl }));
      setPreview({ url: data.publicUrl, type: isVideo ? "video" : "image" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearMedia() {
    setValues((v) => ({ ...v, cover_media_url: "" }));
    setPreview(null);
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!values.title.trim() || !values.content.trim()) return;
        setSubmitting(true);
        try {
          await onSubmit(values);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-5"
    >
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          maxLength={140}
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="excerpt">Excerpt (optional)</Label>
        <Input
          id="excerpt"
          maxLength={240}
          placeholder="One line to hook the reader"
          value={values.excerpt}
          onChange={(e) => setValues((v) => ({ ...v, excerpt: e.target.value }))}
        />
      </div>

      <div>
        <Label>Cover image or video (optional)</Label>
        {preview ? (
          <div className="relative mt-1.5 rounded-2xl overflow-hidden border border-border">
            {preview.type === "video" ? (
              <video
                src={preview.url}
                controls
                className="w-full max-h-64 object-cover"
              />
            ) : (
              <img
                src={preview.url}
                alt="Cover preview"
                className="w-full max-h-64 object-cover"
              />
            )}
            <button
              type="button"
              onClick={clearMedia}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Remove media"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-1.5 w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/30 py-8 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <Upload className="h-6 w-6" />
            <span className="text-sm">{uploading ? "Uploading…" : "Click to upload image or video"}</span>
            <span className="text-xs">JPEG, PNG, GIF, WebP, MP4, WebM</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/ogg"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          required
          rows={16}
          className="rounded-2xl font-serif text-base leading-relaxed"
          value={values.content}
          onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || uploading} className="rounded-full h-11 px-8">
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
