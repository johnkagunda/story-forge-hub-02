import { useEffect } from "react";

/**
 * Tracks a unique blog view using FingerprintJS.
 * Fires once when the component mounts.
 * Fails silently so the blog experience is never interrupted.
 */
export function useBlogViewTracker(slug: string | undefined) {
  useEffect(() => {
    if (!slug) return;

    const currentSlug = slug;
    let cancelled = false;

    async function track() {
      try {
        // Dynamically import FingerprintJS only when needed
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");

        // Load the agent
        const fp = await FingerprintJS.load();

        // Generate a visitor identifier
        const result = await fp.get();

        if (cancelled) return;

        const visitorId = result.visitorId;

        // Send the view event to the backend
        await fetch(`/api/blogs/${encodeURIComponent(currentSlug)}/view`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ visitorId }),
        });
      } catch {
        // Fail silently — the blog should display even if tracking fails
      }
    }

    track();

    return () => {
      cancelled = true;
    };
  }, [slug]);
}

