import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Pencil, Check, X, Bookmark } from "lucide-react";

export const Route = createFileRoute("/profile")({
  ssr: false,
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile · SoshoBird" }] }),
});

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

function ProfilePage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  useEffect(() => {
    if (profileQ.data?.display_name) {
      setNameInput(profileQ.data.display_name);
    }
  }, [profileQ.data]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const trimmed = nameInput.trim();
      if (!trimmed) throw new Error("Name can't be empty");
      if (trimmed.length > 40) throw new Error("Name too long (max 40 chars)");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      setEditing(false);
      toast.success("Name updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const bookmarksQ = useQuery({
    queryKey: ["bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("bookmarks")
        .select("id, created_at, posts(id, slug, title, excerpt, created_at)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        created_at: string;
        posts: { id: string; slug: string; title: string; excerpt: string | null; created_at: string } | null;
      }[];
    },
  });

  const removeBookmark = useMutation({
    mutationFn: async (bookmarkId: string) => {
      const { error } = await db.from("bookmarks").delete().eq("id", bookmarkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks", user?.id] });
      toast.success("Bookmark removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !user) return null;

  const profile = profileQ.data;
  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "User";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="font-serif text-2xl font-bold mb-8">Your Profile</h1>

      {/* Avatar + name */}
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-5 mb-6">
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary text-white text-xl font-bold">
            {initial}
          </AvatarFallback>   
        </Avatar>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Label htmlFor="display-name" className="text-xs text-muted-foreground">
                Display name
              </Label>
              <div className="flex gap-2">
                <Input
                  id="display-name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={40}
                  className="h-9 rounded-lg bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateProfile.mutate();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  autoFocus
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-lg shrink-0"
                  onClick={() => updateProfile.mutate()}
                  disabled={updateProfile.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 rounded-lg shrink-0"
                  onClick={() => { setEditing(false); setNameInput(profile?.display_name ?? ""); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div>
                <p className="font-semibold text-base truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Edit name"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account</h2>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Email</span>
          <span className="truncate max-w-[60%] text-right">{user.email}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Member since</span>
          <span>{new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* Bookmarks */}
      <div className="mt-8">
        <h2 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" /> Bookmarks
        </h2>

        {bookmarksQ.isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {bookmarksQ.data?.length === 0 && !bookmarksQ.isLoading && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Bookmark className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No bookmarks yet. Save posts to read them later.</p>
          </div>
        )}

        <div className="space-y-3">
          {bookmarksQ.data?.map((bm) => {
            const post = bm.posts;
            if (!post) return null;
            return (
              <div key={bm.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3 hover:border-primary/30 transition-colors">
                <Link to="/posts/$slug" params={{ slug: post.slug }} className="flex-1 min-w-0">
                  <p className="font-serif font-semibold text-base leading-snug hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </p>
                  {post.excerpt && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                  )}
                </Link>
                <button
                  onClick={() => removeBookmark.mutate(bm.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                  aria-label="Remove bookmark"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back home</Link>
      </div>
    </div>
  );
}
