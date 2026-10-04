import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Facebook, Instagram, Youtube, Twitter, Globe } from "lucide-react";
import type { FooterData, FooterSection, FooterItem } from "@/routes/_authenticated/admin.settings";

const EMPTY_FOOTER: FooterData = { sections: [] };

function SocialIcon({ icon }: { icon?: string }) {
  const cls = "h-4 w-4 shrink-0";
  switch (icon?.toLowerCase()) {
    case "facebook":  return <Facebook className={cls} />;
    case "instagram": return <Instagram className={cls} />;
    case "youtube":   return <Youtube className={cls} />;
    case "x":
    case "twitter":   return <Twitter className={cls} />;
    default:          return icon ? <Globe className={cls} /> : null;
  }
}

function FooterItemView({ item }: { item: FooterItem }) {
  if (item.type === "text") {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {item.content}
      </p>
    );
  }
  return (
    <a
      href={item.url || "#"}
      target={item.url?.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <SocialIcon icon={item.icon} />
      {item.label}
    </a>
  );
}

function FooterSectionCol({ section }: { section: FooterSection }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wider text-xs text-muted-foreground mb-3 border-b border-border/50 pb-2">
        {section.title}
      </p>
      <ul className="space-y-2.5">
        {section.items.map((item, i) => (
          <li key={i}>
            <FooterItemView item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { data } = useQuery({
    queryKey: ["site_settings", "footer"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("site_settings")
        .select("value")
        .eq("key", "footer")
        .maybeSingle();
      if (error) throw error;
      const raw = data?.value;
      if (!raw || !Array.isArray(raw.sections)) return EMPTY_FOOTER;
      return raw as FooterData;
    },
    staleTime: 1000 * 60 * 5,
  });

  const footer = data ?? EMPTY_FOOTER;
  if (footer.sections.length === 0) return null;

  const cols = Math.min(footer.sections.length, 4);
  const gridClass = (
    { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" } as Record<number, string>
  )[cols] ?? "grid-cols-2 sm:grid-cols-4";

  return (
    <footer className="bg-card border-t border-border mt-10 pb-16">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-8 border-b border-border pb-6">
          <span className="font-serif text-2xl font-bold">
            Sosho<span className="text-primary">Bird</span>
          </span>
        </div>

        <div className={`grid ${gridClass} gap-8`}>
          {footer.sections.map((section) => (
            <FooterSectionCol key={section.id} section={section} />
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SoshoBird. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
