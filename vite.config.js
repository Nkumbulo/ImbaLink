import { defineConfig } from 'vite';

export default defineConfig({
  // Use React's automatic JSX runtime so JSX files do not require a
  // manual `import React` solely to render JSX.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Splits stable, rarely-changing third-party code out of the main
        // app chunk so browsers can cache it across deploys instead of
        // re-downloading it every time app code changes. Pure build-output
        // grouping — does not change what loads eagerly vs lazily, or any
        // app behavior.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
