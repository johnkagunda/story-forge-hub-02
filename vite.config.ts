import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: ["story-forge-hub-02.onrender.com"],
    },
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});