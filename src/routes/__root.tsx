import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/useSession";
import { Home, Compass, Bell, User, PenLine } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-serif text-foreground">404</h1>
        <p className="mt-3 text-muted-foreground">This story doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-serif">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SoshoBird" },
      { name: "description", content: "Personal essays, notes, and stories." },
      { name: "theme-color", content: "#0a0a0a" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function BottomNav() {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
      <div className="max-w-lg mx-auto flex items-center justify-around h-14 px-2">
        <Link
          to="/"
          className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors px-3 py-1 [&.active]:text-primary"
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px]">Home</span>
        </Link>

        <Link
          to="/explore"
          className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors px-3 py-1 [&.active]:text-primary"
        >
          <Compass className="h-5 w-5" />
          <span className="text-[10px]">Explore</span>
        </Link>

        {isAdmin && (
          <Link
            to="/admin/new"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-lg hover:opacity-90 transition-opacity [&.active]:opacity-80"
          >
            <PenLine className="h-5 w-5" />
          </Link>
        )}

        <Link
          to="/"
          className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
        >
          <Bell className="h-5 w-5" />
          <span className="text-[10px]">Alerts</span>
        </Link>

        <Link
          to={user ? "/profile" : "/auth"}
          className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors px-3 py-1 [&.active]:text-primary"
        >
          <User className="h-5 w-5" />
          <span className="text-[10px]">Profile</span>
        </Link>
      </div>
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col pb-14">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <BottomNav />
      <Toaster position="top-center" richColors theme="dark" />
    </QueryClientProvider>
  );
}
