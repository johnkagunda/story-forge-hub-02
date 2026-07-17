import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PostFormValues = {
  title: string;
  excerpt: string;
  cover_image_url: string;
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
    initial ?? { title: "", excerpt: "", cover_image_url: "", content: "" },
  );
  const [submitting, setSubmitting] = useState(false);

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
        <Label htmlFor="cover">Cover image URL (optional)</Label>
        <Input
          id="cover"
          type="url"
          placeholder="https://…"
          value={values.cover_image_url}
          onChange={(e) => setValues((v) => ({ ...v, cover_image_url: e.target.value }))}
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
        <Button type="submit" disabled={submitting} className="rounded-full h-11 px-8">
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
