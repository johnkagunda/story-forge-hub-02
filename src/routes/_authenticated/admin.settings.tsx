import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, GripVertical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
  head: () => ({ meta: [{ title: "Site Settings · Admin" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type FooterLink = {
  label: string;
  url: string;
  icon?: string; // optional: facebook | instagram | x | youtube | etc
};

export type FooterSection = {
  id: string;        // stable random id
  title: string;
  links: FooterLink[];
};

export type FooterData = {
  sections: FooterSection[];
};

export const EMPTY_FOOTER: FooterData = { sections: [] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Section editor ───────────────────────────────────────────────────────────
function SectionEditor({
  section,
  onUpdate,
  onRemove,
}: {
  section: FooterSection;
  onUpdate: (s: FooterSection) => void;
  onRemove: () => void;
}) {
  function updateLink(i: number, field: keyof FooterLink, val: string) {
    const links = section.links.map((l, idx) => (idx === i ? { ...l, [field]: val } : l));
    onUpdate({ ...section, links });
  }
  function removeLink(i: number) {
    onUpdate({ ...section, links: section.links.filter((_, idx) => idx !== i) });
  }
  function addLink() {
    onUpdate({ ...section, links: [...section.links, { label: "", url: "", icon: "" }] });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={section.title}
          onChange={(e) => onUpdate({ ...section, title: e.target.value })}
          placeholder="Section title"
          className="flex-1 font-semibold"
        />
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          aria-label="Remove section"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Links */}
      <div className="space-y-2 pl-7">
        {section.links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Label"
              value={link.label}
              onChange={(e) => updateLink(i, "label", e.target.value)}
              className="flex-1 min-w-0"
            />
            <Input
              placeholder="URL  (e.g. https://... or /page)"
              value={link.url}
              onChange={(e) => updateLink(i, "url", e.target.value)}
              className="flex-1 min-w-0"
            />
            <Input
              placeholder="Icon? (facebook/instagram/x/youtube)"
              value={link.icon ?? ""}
              onChange={(e) => updateLink(i, "icon", e.target.value)}
              className="w-48 shrink-0 hidden sm:block"
            />
            <button
              onClick={() => removeLink(i)}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              aria-label="Remove link"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          onClick={addLink}
          className="flex items-center gap-1.5 text-xs text-primary hover:opacity-75 transition-opacity mt-1"
        >
          <Plus className="h-3.5 w-3.5" /> Add link
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function AdminSettings() {
  const navigate = useNavigate();
  const { loading: sessionLoading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const qc = useQueryClient();
  const isLoading = sessionLoading || adminLoading;

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const [footer, setFooter] = useState<FooterData>(EMPTY_FOOTER);

  const settingsQ = useQuery({
    queryKey: ["site_settings", "footer"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await db
        .from("site_settings")
        .select("value")
        .eq("key", "footer")
        .maybeSingle();
      if (error) throw error;
      // migrate old shape → new shape if needed
      const raw = data?.value;
      if (!raw) return EMPTY_FOOTER;
      if (Array.isArray(raw.sections)) return raw as FooterData;
      // legacy shape: convert to sections
      const sections: FooterSection[] = [];
      if (raw.company_links?.length) sections.push({ id: uid(), title: "More About Our Company", links: raw.company_links });
      if (raw.social_links?.length) sections.push({ id: uid(), title: "Social Media", links: raw.social_links });
      if (raw.brands?.length) sections.push({ id: uid(), title: "Our Brands", links: raw.brands });
      return { sections } as FooterData;
    },
  });

  useEffect(() => {
    if (settingsQ.data) setFooter(settingsQ.data);
  }, [settingsQ.data]);

  function addSection() {
    setFooter((f) => ({
      sections: [...f.sections, { id: uid(), title: "New Section", links: [] }],
    }));
  }

  function updateSection(id: string, updated: FooterSection) {
    setFooter((f) => ({ sections: f.sections.map((s) => (s.id === id ? updated : s)) }));
  }

  function removeSection(id: string) {
    setFooter((f) => ({ sections: f.sections.filter((s) => s.id !== id) }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from("site_settings")
        .upsert({ key: "footer", value: footer, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site_settings", "footer"] });
      toast.success("Footer saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !isAdmin) {
    return <p className="text-center py-20 text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-bold">Footer Settings</h1>
          <p className="text-sm text-muted-foreground">
            Add sections and links — all rendered dynamically in the site footer
          </p>
        </div>
      </div>

      {/* Sections */}
      {footer.sections.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
          No sections yet. Add one below.
        </div>
      )}

      {footer.sections.map((section) => (
        <SectionEditor
          key={section.id}
          section={section}
          onUpdate={(updated) => updateSection(section.id, updated)}
          onRemove={() => removeSection(section.id)}
        />
      ))}

      {/* Add section */}
      <button
        onClick={addSection}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" /> Add section
      </button>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-full px-8"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
