import { Link, useNavigate } from "@tanstack/react-router";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, LogOut, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function Header() {
  const { user, loading } = useSession();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-serif text-xl font-bold tracking-tight text-foreground">
          Warm<span className="text-primary">Notes</span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/", search: { q: "" } })}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {loading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full ring-2 ring-border focus:outline-none focus:ring-primary transition-all">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-primary text-white text-xs font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-card border-border">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground font-normal">
                  {user.email}
                </DropdownMenuLabel>
                {isAdmin && (
                  <>
                    <DropdownMenuLabel className="text-xs text-primary pt-0">Admin</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                      <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
