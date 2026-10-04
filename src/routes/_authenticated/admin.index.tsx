import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { Button } from "@/components/ui/button";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { Eye, Pencil, Plus, Users, TrendingUp, FileText, BarChart2, Mail } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Admin Dashboard · Warm Notes" }] }),
});

type PostWithViews = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published: boolean;
  created_at: string;
  views: number;
};

type ViewRow = {
  created_at: string;
  session_id: string | null;
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold font-serif">{value}</p>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { loading: sessionLoading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const isLoading = sessionLoading || adminLoading;

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const postsQ = useQuery({
    queryKey: ["admin", "posts"],
    enabled: !!isAdmin,
    queryFn: async () => {
      // Fetch posts and count views from post_views table to avoid
      // dependency on the views column migration being applied
      const { data, error } = await supabase
        .from("posts")
        .select("id, slug, title, excerpt, published, created_at, post_views(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        published: p.published,
        created_at: p.created_at,
        views: Array.isArray(p.post_views)
          ? (p.post_views[0] as { count: number } | undefined)?.count ?? 0
          : 0,
      })) as PostWithViews[];
    },
  });

  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json() as { users: { id: string; email: string | null; created_at: string }[] };
      return json.users;
    },
  });

  // Last 30 days of view events for the chart + unique visitor count
  const analyticsQ = useQuery({
    queryKey: ["admin", "analytics"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const since = subDays(new Date(), 29).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("post_views")
        .select("created_at, session_id")
        .gte("created_at", since);
      if (error) throw error;

      const rows = (data ?? []) as ViewRow[];

      // Build daily buckets for the last 30 days
      const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
      const buckets: Record<string, number> = {};
      days.forEach((d) => { buckets[format(d, "MMM d")] = 0; });

      rows.forEach((r) => {
        const key = format(startOfDay(new Date(r.created_at)), "MMM d");
        if (key in buckets) buckets[key]++;
      });

      const chartData = Object.entries(buckets).map(([date, views]) => ({ date, views }));
      const uniqueVisitors = new Set(rows.map((r) => r.session_id).filter(Boolean)).size;

      return { chartData, uniqueVisitors, totalViews30d: rows.length };
    },
  });

  if (isLoading || !isAdmin) {
    return <p className="text-center py-20 text-muted-foreground">Loading…</p>;
  }

  const posts = postsQ.data ?? [];
  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const topPosts = [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Analytics &amp; post management</p>
        </div>
        <Link to="/admin/new">
          <Button className="rounded-full gap-2">
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </Link>
        <Link to="/admin/settings">
          <Button variant="outline" className="rounded-full gap-2">
            Site Settings
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Eye className="h-4 w-4" />} label="Total views" value={totalViews.toLocaleString()} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Unique visitors (30d)" value={(analyticsQ.data?.uniqueVisitors ?? 0).toLocaleString()} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Views last 30d" value={(analyticsQ.data?.totalViews30d ?? 0).toLocaleString()} />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Published posts" value={posts.filter((p) => p.published).length} />
      </div>

      {/* Views chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Views — last 30 days</h2>
        </div>
        {analyticsQ.isLoading ? (
          <div className="h-40 bg-muted animate-pulse rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={analyticsQ.data?.chartData ?? []} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 2" }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#viewsGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top posts */}
      {topPosts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Top posts by views
          </h2>
          <div className="space-y-3">
            {topPosts.map((post, i) => (
              <div key={post.id} className="flex items-center gap-3">
                <span className="text-lg font-serif font-bold text-muted-foreground w-6 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(post.created_at), "MMM d, yyyy")}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{(post.views ?? 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registered users */}
      <div>
        <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="h-4 w-4" /> Registered users
        </h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {usersQ.isLoading && (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-muted rounded animate-pulse w-2/3" />
              ))}
            </div>
          )}
          {usersQ.error && (
            <p className="text-sm text-destructive p-5">Failed to load users.</p>
          )}
          {usersQ.data && usersQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground p-5">No users yet.</p>
          )}
          {usersQ.data && usersQ.data.length > 0 && (
            <div className="divide-y divide-border">
              {usersQ.data.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{u.email ?? "—"}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(u.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All posts */}
      <div>
        <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">All posts</h2>

        {postsQ.isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {postsQ.error && (
          <div className="text-center py-12 text-destructive text-sm">Failed to load posts.</div>
        )}

        {posts.length === 0 && !postsQ.isLoading && (
          <div className="text-center py-20">
            <p className="font-serif text-xl text-foreground mb-2">No posts yet</p>
            <p className="text-sm text-muted-foreground">Create your first post to get started.</p>
            <Link to="/admin/new" className="inline-block mt-4">
              <Button className="rounded-full">Write a post</Button>
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-serif text-lg font-bold truncate">{post.title}</h2>
                  {!post.published && (
                    <span className="text-[10px] uppercase tracking-widest text-destructive font-semibold bg-destructive/10 px-2 py-0.5 rounded-full">
                      Draft
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{format(new Date(post.created_at), "MMM d, yyyy")}</span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    <span>{post.views ?? 0} {(post.views ?? 0) === 1 ? "view" : "views"}</span>
                  </span>
                </div>
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground/70 mt-1 line-clamp-1">{post.excerpt}</p>
                )}
              </div>
              <Link to="/admin/$id/edit" params={{ id: post.id }}>
                <Button variant="outline" size="sm" className="rounded-full shrink-0">
                  <Pencil className="h-4 w-4 mr-1.5" /> Edit
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
