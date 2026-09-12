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
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
            return 'vendor-leaflet';
          }
          return undefined;
        },
      },
    },
  },
});
